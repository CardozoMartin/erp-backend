import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { TipoComprobante } from 'src/comprobantes/entities/comprobante.entity';
import { ArcaConfig } from './entities/arca-config.entity';
import { ArcaWsaaService } from './arca-wsaa.service';
import { DetalleAlicuota, ALICUOTA_AFIP_ID } from './arca-iva.helper';

export interface SolicitudCAE {
  tipo:         TipoComprobante;
  /** Código AFIP explícito; si falta se deriva de `tipo` */
  codigoCbte?:  number;
  puntoVenta:   number;
  cuit:         string;
  /** Número del comprobante (último autorizado + 1) */
  numero:       number;
  fechaCbte:    string; // YYYYMMDD
  importeTotal: number;
  importeNeto:  number;
  importeIva:   number;
  /** CUIT del receptor — null para consumidor final */
  cuitReceptor: string | null;
  /** DNI del receptor (si no tiene CUIT) */
  dniReceptor:  string | null;
  condicionIvaReceptor: number; // 1=RI, 5=CF, 6=Exento, 13=Monotrib
  /** Desglose por alícuota; si falta se usa una sola al 21% */
  alicuotas?: DetalleAlicuota[];
  /** Importe exento (alícuota 0) — va en ImpOpEx */
  importeExento?: number;
  /**
   * Comprobante asociado. Obligatorio en notas de crédito/débito: AFIP exige
   * vincular la NC con la factura que corrige.
   */
  comprobanteAsociado?: {
    tipo: number;   // código AFIP del comprobante original
    puntoVenta: number;
    numero: number;
    cuit?: string | null;
  } | null;
}

export interface RespuestaCAE {
  cae:            string;
  caeVencimiento: Date;
  numeroCbte:     number;
}

/** Mapa TipoComprobante → código AFIP */
const CODIGO_CBTE: Partial<Record<TipoComprobante, number>> = {
  [TipoComprobante.FACTURA_A]: 1,
  [TipoComprobante.FACTURA_B]: 6,
  [TipoComprobante.FACTURA_C]: 11,
  [TipoComprobante.TICKET]:    6, // ticket trata como B para AFIP
};

/**
 * Nota de crédito según la letra de la factura que corrige: NC A=3, B=8, C=13.
 * La letra la define el comprobante original, no el emisor.
 */
export const CODIGO_NOTA_CREDITO: Record<number, number> = {
  1: 3,   // Factura A  -> NC A
  6: 8,   // Factura B  -> NC B
  11: 13, // Factura C  -> NC C
};

@Injectable()
export class ArcaWsfev1Service {
  private readonly logger = new Logger(ArcaWsfev1Service.name);

  private readonly URL_WSFE = {
    testing:    'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
    produccion: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
  };

  constructor(private readonly wsaa: ArcaWsaaService) {}

  /** Solicita autorización CAE para un comprobante */
  async solicitarCAE(
    config: ArcaConfig,
    solicitud: SolicitudCAE,
  ): Promise<RespuestaCAE> {
    // 1.- Obtener ticket de acceso (cacheado si está vigente)
    const { token, sign } = await this.wsaa.obtenerTicketAcceso(config, 'wsfe');

    // 2.- Construir el SOAP de FECAESolicitar.
    // Las notas de crédito pasan su código explícito (3/8/13): no se puede
    // derivar del tipo porque depende de la letra de la factura que corrigen.
    const codigoCbte = solicitud.codigoCbte ?? CODIGO_CBTE[solicitud.tipo] ?? 6;
    const url = this.URL_WSFE[config.ambiente];
    const cuitNumerico = solicitud.cuit.replace(/-/g, '');

    const soap = this.buildSoapFECAESolicitar({
      token,
      sign,
      cuit: cuitNumerico,
      codigoCbte,
      puntoVenta: solicitud.puntoVenta,
      numero: solicitud.numero,
      fechaCbte: solicitud.fechaCbte,
      importeTotal: solicitud.importeTotal,
      importeNeto:  solicitud.importeNeto,
      importeIva:   solicitud.importeIva,
      cuitReceptor: solicitud.cuitReceptor?.replace(/-/g, '') ?? null,
      dniReceptor:  solicitud.dniReceptor ?? null,
      condicionIvaReceptor: solicitud.condicionIvaReceptor,
      alicuotas:     solicitud.alicuotas,
      importeExento: solicitud.importeExento,
      comprobanteAsociado: solicitud.comprobanteAsociado,
    });

    // 3.- Llamar al WSFEv1
    const respuestaXml = await this.llamarWsfev1(url, soap, 'FECAESolicitar');

    // 4.- Parsear y devolver CAE
    return this.parsearRespuestaCAE(respuestaXml);
  }

  /** Consulta el último número de comprobante autorizado para un tipo y punto de venta */
  async ultimoComprobante(
    config: ArcaConfig,
    codigoCbte: number,
    puntoVenta: number,
  ): Promise<number> {
    const { token, sign } = await this.wsaa.obtenerTicketAcceso(config, 'wsfe');
    const cuit = config.cuit.replace(/-/g, '');
    const url  = this.URL_WSFE[config.ambiente];

    const soap = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Body>
    <ar:FECompUltimoAutorizado>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${cuit}</ar:Cuit>
      </ar:Auth>
      <ar:PtoVta>${puntoVenta}</ar:PtoVta>
      <ar:CbteTipo>${codigoCbte}</ar:CbteTipo>
    </ar:FECompUltimoAutorizado>
  </soapenv:Body>
</soapenv:Envelope>`;

    const respXml = await this.llamarWsfev1(url, soap, 'FECompUltimoAutorizado');
    return this.parsearUltimoComprobante(respXml);
  }

  // ── helpers privados ────────────────────────────────────────────────────────

  private buildSoapFECAESolicitar(p: {
    token: string; sign: string; cuit: string;
    codigoCbte: number; puntoVenta: number; numero: number;
    fechaCbte: string; importeTotal: number; importeNeto: number; importeIva: number;
    cuitReceptor: string | null; dniReceptor: string | null; condicionIvaReceptor: number;
    alicuotas?: DetalleAlicuota[]; importeExento?: number;
    comprobanteAsociado?: SolicitudCAE['comprobanteAsociado'];
  }): string {
    // Receptor: consumidor final (DNI) o contribuyente (CUIT)
    const docTipo = p.cuitReceptor ? 80 : (p.dniReceptor ? 96 : 99);
    const docNro  = p.cuitReceptor ?? p.dniReceptor ?? '0';

    // Los comprobantes clase C (monotributo) no discriminan IVA: el total va
    // como neto y sin nodo <Iva>. Incluye Factura C (11), NC C (13) y ND C (12);
    // AFIP los rechaza con error 10071 si se informa el objeto IVA.
    const esClaseC = p.codigoCbte === 11 || p.codigoCbte === 12 || p.codigoCbte === 13;
    const neto   = esClaseC ? p.importeTotal : p.importeNeto;
    const iva    = esClaseC ? 0 : p.importeIva;
    const exento = esClaseC ? 0 : (p.importeExento ?? 0);

    // Un <AlicIva> por alícuota presente en los items. Si no vino el desglose se
    // cae a una sola al 21%, que es el comportamiento histórico.
    const alicuotas: DetalleAlicuota[] =
      p.alicuotas?.length
        ? p.alicuotas
        : [{ id: ALICUOTA_AFIP_ID['21'], porcentaje: 21, baseImponible: neto, importe: iva }];

    // Las notas de crédito deben declarar la factura que corrigen
    const asoc = p.comprobanteAsociado;
    const nodoCbtesAsoc = asoc
      ? `
            <ar:CbtesAsoc>
              <ar:CbteAsoc>
                <ar:Tipo>${asoc.tipo}</ar:Tipo>
                <ar:PtoVta>${asoc.puntoVenta}</ar:PtoVta>
                <ar:Nro>${asoc.numero}</ar:Nro>${
                  asoc.cuit ? `
                <ar:Cuit>${asoc.cuit.replace(/-/g, '')}</ar:Cuit>` : ''
                }
              </ar:CbteAsoc>
            </ar:CbtesAsoc>`
      : '';

    const nodoIva = esClaseC
      ? ''
      : `
            <ar:Iva>${alicuotas
              .map(
                (a) => `
              <ar:AlicIva>
                <ar:Id>${a.id}</ar:Id>
                <ar:BaseImp>${a.baseImponible.toFixed(2)}</ar:BaseImp>
                <ar:Importe>${a.importe.toFixed(2)}</ar:Importe>
              </ar:AlicIva>`,
              )
              .join('')}
            </ar:Iva>`;

    return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Body>
    <ar:FECAESolicitar>
      <ar:Auth>
        <ar:Token>${p.token}</ar:Token>
        <ar:Sign>${p.sign}</ar:Sign>
        <ar:Cuit>${p.cuit}</ar:Cuit>
      </ar:Auth>
      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>1</ar:CantReg>
          <ar:PtoVta>${p.puntoVenta}</ar:PtoVta>
          <ar:CbteTipo>${p.codigoCbte}</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>1</ar:Concepto>
            <ar:DocTipo>${docTipo}</ar:DocTipo>
            <ar:DocNro>${docNro}</ar:DocNro>
            <ar:CbteDesde>${p.numero}</ar:CbteDesde>
            <ar:CbteHasta>${p.numero}</ar:CbteHasta>
            <ar:CbteFch>${p.fechaCbte}</ar:CbteFch>
            <ar:ImpTotal>${p.importeTotal.toFixed(2)}</ar:ImpTotal>
            <ar:ImpTotConc>0.00</ar:ImpTotConc>
            <ar:ImpNeto>${neto.toFixed(2)}</ar:ImpNeto>
            <ar:ImpOpEx>${exento.toFixed(2)}</ar:ImpOpEx>
            <ar:ImpIVA>${iva.toFixed(2)}</ar:ImpIVA>
            <ar:ImpTrib>0.00</ar:ImpTrib>
            <ar:MonId>PES</ar:MonId>
            <ar:MonCotiz>1</ar:MonCotiz>
            <ar:CondicionIVAReceptorId>${p.condicionIvaReceptor}</ar:CondicionIVAReceptorId>${nodoCbtesAsoc}${nodoIva}
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  private async llamarWsfev1(url: string, soap: string, accion: string): Promise<string> {
    try {
      const resp = await axios.post(url, soap, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          SOAPAction: `http://ar.gov.afip.dif.FEV1/${accion}`,
        },
        timeout: 30_000,
      });
      return resp.data as string;
    } catch (err: unknown) {
      const e = err as { response?: { data?: unknown }; message?: string };
      const msg = e.response?.data ?? e.message;
      this.logger.error(`Error WSFEv1 (${accion}):`, msg);
      throw new InternalServerErrorException(
        `AFIP WSFEv1 (${accion}) no respondió correctamente: ${String(msg).slice(0, 300)}`,
      );
    }
  }

  private async parsearRespuestaCAE(xml: string): Promise<RespuestaCAE> {
    try {
      const parsed = await parseStringPromise(xml, { explicitArray: false });
      const body = this.extraerBody(parsed);

      const result = this.buscarClave<{
        Errors?: { Err?: unknown };
        FeDetResp?: { FECAEDetResponse?: Record<string, unknown> };
      }>(body, 'FECAESolicitarResult');

      const detResp = result?.FeDetResp?.FECAEDetResponse as
        | Record<string, any>
        | undefined;

      if (detResp?.Resultado !== 'A') {
        // AFIP separa errores de request (Errors) de observaciones del detalle
        // (Observaciones). Un rechazo puede traer cualquiera de las dos.
        const msg = [
          ...this.listarMensajes(result?.Errors?.Err),
          ...this.listarMensajes(detResp?.Observaciones?.Obs),
        ].join(' | ');

        throw new Error(
          `AFIP rechazó el comprobante: ${msg || 'sin detalle en la respuesta'}`,
        );
      }

      const caeVencStr = detResp.CAEFchVto as string; // YYYYMMDD
      // Fecha local, no UTC: con 'T00:00:00Z' el vencimiento se persistía un día
      // antes en zonas negativas (AR es UTC-3).
      const caeVenc = new Date(
        Number(caeVencStr.slice(0, 4)),
        Number(caeVencStr.slice(4, 6)) - 1,
        Number(caeVencStr.slice(6, 8)),
      );

      return {
        cae:            detResp.CAE as string,
        caeVencimiento: caeVenc,
        numeroCbte:     Number(detResp.CbteDesde),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(
        `Error parseando respuesta CAE: ${msg}`,
      );
    }
  }

  private async parsearUltimoComprobante(xml: string): Promise<number> {
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const body = this.extraerBody(parsed);
    const result = this.buscarClave<{ CbteNro?: unknown; Errors?: { Err?: unknown } }>(
      body,
      'FECompUltimoAutorizadoResult',
    );

    const errores = this.listarMensajes(result?.Errors?.Err);
    if (errores.length) {
      throw new InternalServerErrorException(
        `AFIP rechazó la consulta de último comprobante: ${errores.join(' | ')}`,
      );
    }

    return Number(result?.CbteNro ?? 0);
  }

  /**
   * Devuelve el Body del sobre SOAP sin depender del prefijo de namespace:
   * AFIP responde indistintamente con soap:, soapenv: o S:.
   */
  private extraerBody(parsed: Record<string, any>): Record<string, any> {
    const envelope = Object.entries(parsed).find(([k]) =>
      k.toLowerCase().includes('envelope'),
    )?.[1] as Record<string, any> | undefined;

    if (!envelope) return parsed;

    const body = Object.entries(envelope).find(([k]) =>
      k.toLowerCase().includes('body'),
    )?.[1] as Record<string, any> | undefined;

    return body ?? envelope;
  }

  /** Busca una clave en el árbol ignorando el prefijo de namespace */
  private buscarClave<T>(nodo: unknown, nombre: string): T | undefined {
    if (!nodo || typeof nodo !== 'object') return undefined;

    for (const [clave, valor] of Object.entries(nodo as Record<string, unknown>)) {
      if (clave === nombre || clave.endsWith(`:${nombre}`)) return valor as T;
      const encontrado = this.buscarClave<T>(valor, nombre);
      if (encontrado !== undefined) return encontrado;
    }
    return undefined;
  }

  /** Normaliza Err/Obs (pueden venir como objeto único o array) a texto legible */
  private listarMensajes(nodo: unknown): string[] {
    if (!nodo) return [];
    const items = Array.isArray(nodo) ? nodo : [nodo];
    return items
      .map((o) => {
        const { Code, Msg } = (o ?? {}) as { Code?: unknown; Msg?: unknown };
        return Code || Msg ? `${String(Code ?? '?')}: ${String(Msg ?? '')}`.trim() : '';
      })
      .filter(Boolean);
  }
}
