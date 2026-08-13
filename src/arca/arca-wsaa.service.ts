import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as forge from 'node-forge';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { ArcaConfig } from './entities/arca-config.entity';
import { CifradoService } from 'src/shared/cifrado.service';
import { ARCA_CIFRADO } from 'src/shared/shared.module';

/** Servicio de login del WSFEv1: obtiene y cachea el Ticket de Acceso (TA) */
@Injectable()
export class ArcaWsaaService {
  private readonly logger = new Logger(ArcaWsaaService.name);

  private readonly URL_WSAA = {
    testing:    'https://wsaahomo.afip.gov.ar/ws/services/LoginCms?wsdl',
    produccion: 'https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl',
  };

  constructor(
    @InjectRepository(ArcaConfig)
    private readonly repo: Repository<ArcaConfig>,
    @Inject(ARCA_CIFRADO)
    private readonly cifrado: CifradoService,
  ) {}

  /**
   * Devuelve un TA (Ticket de Acceso) válido para el servicio solicitado.
   * Si el TA cacheado sigue vigente lo reutiliza; si no, lo renueva con AFIP.
   */
  async obtenerTicketAcceso(
    config: ArcaConfig,
    servicio: string = 'wsfe',
  ): Promise<{ token: string; sign: string }> {
    // 1.- Verificar si el ticket cacheado sigue vigente (con 5 min de margen)
    if (this.ticketVigente(config)) {
      return this.extraerTokenSign(
        this.cifrado.descifrar(config.ticketAccesoEnc!),
      );
    }

    // 2.- Generar nuevo TRA y firmarlo
    const tra = this.generarTra(servicio);
    const cert = this.cifrado.descifrar(config.certificadoEnc);
    const key  = this.cifrado.descifrar(config.clavePrivadaEnc);
    const cms  = this.firmarTra(tra, cert, key);

    // 3.- Llamar al WSAA de AFIP
    const url = this.URL_WSAA[config.ambiente];
    const respuestaXml = await this.llamarWsaa(url, cms);

    // 4.- Parsear respuesta y extraer TA
    const { token, sign, expiracion } = await this.parsearRespuestaWsaa(respuestaXml);

    // 5.- Cachear el TA cifrado en la base de datos
    config.ticketAccesoEnc  = this.cifrado.cifrar(respuestaXml);
    config.ticketVencimiento = expiracion;
    await this.repo.save(config);

    return { token, sign };
  }

  // ── helpers privados ────────────────────────────────────────────────────────

  private ticketVigente(config: ArcaConfig): boolean {
    if (!config.ticketAccesoEnc || !config.ticketVencimiento) return false;
    const margen = 5 * 60 * 1000; // 5 minutos en ms
    return config.ticketVencimiento.getTime() - Date.now() > margen;
  }

  private generarTra(servicio: string): string {
    const ahora       = new Date();
    const generacion  = this.formatAfipDate(new Date(ahora.getTime() - 60_000)); // -1 min
    const expiracion  = this.formatAfipDate(new Date(ahora.getTime() + 12 * 3600_000)); // +12h

    return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
    <generationTime>${generacion}</generationTime>
    <expirationTime>${expiracion}</expirationTime>
  </header>
  <service>${servicio}</service>
</loginTicketRequest>`;
  }

  private firmarTra(tra: string, certPem: string, keyPem: string): string {
    try {
      const cert = forge.pki.certificateFromPem(certPem);
      const key  = forge.pki.privateKeyFromPem(keyPem);

      const p7 = forge.pkcs7.createSignedData();
      p7.content = forge.util.createBuffer(tra, 'utf8');
      p7.addCertificate(cert);
      p7.addSigner({
        key,
        certificate: cert,
        digestAlgorithm: forge.pki.oids.sha256,
        authenticatedAttributes: [
          { type: forge.pki.oids.contentType,   value: forge.pki.oids.data },
          { type: forge.pki.oids.messageDigest },
          { type: forge.pki.oids.signingTime,    value: new Date().toISOString() },
        ],
      });
      p7.sign();

      const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
      return forge.util.encode64(der);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(
        `Error al firmar TRA con el certificado: ${msg}`,
      );
    }
  }

  private async llamarWsaa(url: string, cms: string): Promise<string> {
    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ser="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <ser:loginCms>
      <in0>${cms}</in0>
    </ser:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

    try {
      const resp = await axios.post(url.replace('?wsdl', ''), soapEnvelope, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          SOAPAction: '',
        },
        timeout: 30_000,
      });
      return resp.data as string;
    } catch (err: unknown) {
      const e = err as { response?: { data?: unknown }; message?: string };
      const msg = e.response?.data ?? e.message;
      this.logger.error('Error WSAA AFIP:', msg);
      throw new InternalServerErrorException(
        `AFIP WSAA no respondió correctamente: ${String(msg).slice(0, 200)}`,
      );
    }
  }

  private async parsearRespuestaWsaa(
    xml: string,
  ): Promise<{ token: string; sign: string; expiracion: Date }> {
    try {
      const parsed = await parseStringPromise(xml, { explicitArray: false });
      const body   =
        parsed['soapenv:Envelope']?.['soapenv:Body'] ??
        parsed['S:Envelope']?.['S:Body'];

      const loginResponse =
        body?.['loginCmsResponse'] ??
        body?.['ns2:loginCmsResponse'];

      const taXml: string =
        loginResponse?.loginCmsReturn ??
        loginResponse?.['return'];

      if (!taXml) {
        throw new Error('No se encontró loginCmsReturn en la respuesta WSAA');
      }

      const ta = await parseStringPromise(taXml, { explicitArray: false });
      const credentials = ta?.loginTicketResponse?.credentials;
      const header      = ta?.loginTicketResponse?.header;

      if (!credentials?.token || !credentials?.sign) {
        throw new Error('La respuesta WSAA no contiene token/sign válidos');
      }

      return {
        token:      credentials.token as string,
        sign:       credentials.sign  as string,
        expiracion: new Date(header?.expirationTime as string),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(
        `Error parseando respuesta WSAA: ${msg}`,
      );
    }
  }

  /**
   * Extrae token y sign del TA cacheado.
   * Lo guardado es la respuesta SOAP completa del WSAA, así que primero hay que
   * desenvolver el envelope y recién ahí parsear el loginTicketResponse interno.
   */
  private async extraerTokenSign(
    taXml: string,
  ): Promise<{ token: string; sign: string }> {
    const parsed = await parseStringPromise(taXml, { explicitArray: false });

    // Si ya viene el TA suelto lo usamos tal cual; si es el SOAP, lo desenvolvemos.
    let ta = parsed?.loginTicketResponse;

    if (!ta) {
      const body =
        parsed['soapenv:Envelope']?.['soapenv:Body'] ??
        parsed['S:Envelope']?.['S:Body'];
      const loginResponse =
        body?.['loginCmsResponse'] ?? body?.['ns2:loginCmsResponse'];
      const interno: string | undefined =
        loginResponse?.loginCmsReturn ?? loginResponse?.['return'];

      if (interno) {
        ta = (await parseStringPromise(interno, { explicitArray: false }))
          ?.loginTicketResponse;
      }
    }

    const credentials = ta?.credentials;
    if (!credentials?.token || !credentials?.sign) {
      throw new InternalServerErrorException(
        'El ticket de acceso cacheado no contiene token/sign válidos',
      );
    }

    return {
      token: credentials.token as string,
      sign:  credentials.sign  as string,
    };
  }

  /**
   * Formatea en ISO-8601 con offset local real (ej: 2026-08-05T17:03:54-03:00).
   * No sirve `toISOString().replace('Z','-03:00')`: eso etiqueta la hora UTC
   * como si fuera local y AFIP la lee 3 horas en el futuro.
   */
  private formatAfipDate(d: Date): string {
    const offsetMin = -d.getTimezoneOffset(); // Argentina => -180
    const signo     = offsetMin >= 0 ? '+' : '-';
    const abs       = Math.abs(offsetMin);
    const pad       = (n: number) => String(n).padStart(2, '0');

    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
      `${signo}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
    );
  }
}
