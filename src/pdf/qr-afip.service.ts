import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { Comprobante } from 'src/comprobantes/entities/comprobante.entity';

/**
 * QR de comprobantes electrónicos (RG 4892).
 *
 * El QR es obligatorio en la factura impresa, así que se genera localmente:
 * depender de un servicio externo significa emitir sin QR cada vez que no hay
 * internet.
 */
@Injectable()
export class QrAfipService {
  private readonly logger = new Logger(QrAfipService.name);

  private readonly BASE_URL = 'https://www.afip.gob.ar/fe/qr/?p=';

  /** Devuelve la URL que codifica el QR, o '' si faltan datos obligatorios */
  construirUrl(p: {
    comprobante: Comprobante;
    cuitEmisor: string | null | undefined;
    puntoVenta: string | null | undefined;
    codigoFiscal: string | number | null | undefined;
    /** Receptor del comprobante; null = consumidor final sin identificar */
    cliente?: { cuit?: string | null; dni?: string | null } | null;
  }): string {
    const cuit = this.soloDigitos(p.cuitEmisor);
    const cae = this.soloDigitos(p.comprobante.cae);
    const ptoVta = this.soloDigitos(p.puntoVenta);
    const tipoCmp = this.soloDigitos(String(p.codigoFiscal ?? ''));

    // Sin CAE no hay comprobante autorizado: no corresponde QR.
    if (!cuit || !cae || !ptoVta || !tipoCmp) return '';

    const fecha = this.fechaLocalISO(p.comprobante.created_at);
    const receptor = this.receptor(p.cliente);

    const payload = {
      ver: 1,
      fecha,
      cuit: Number(cuit),
      ptoVta: Number(ptoVta),
      tipoCmp: Number(tipoCmp),
      nroCmp: Number(p.comprobante.numero_secuencial ?? 0),
      importe: Number(Number(p.comprobante.total ?? 0).toFixed(2)),
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: receptor.tipo,
      nroDocRec: receptor.nro,
      tipoCodAut: 'E',
      codAut: Number(cae),
    };

    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `${this.BASE_URL}${encoded}`;
  }

  /** PNG del QR como data URI, listo para <img> o para PDFKit */
  async generarDataUri(url: string): Promise<string | null> {
    if (!url) return null;
    try {
      return await QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
    } catch (err: unknown) {
      this.logger.error(
        `No se pudo generar el QR AFIP: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /** Buffer PNG del QR — PDFKit necesita buffer, no data URI */
  async generarBuffer(url: string): Promise<Buffer | null> {
    if (!url) return null;
    try {
      return await QRCode.toBuffer(url, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
    } catch (err: unknown) {
      this.logger.error(
        `No se pudo generar el QR AFIP: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /**
   * El receptor del QR debe reflejar el del comprobante: 80=CUIT, 96=DNI,
   * 99=consumidor final sin identificar.
   */
  private receptor(
    cliente?: { cuit?: string | null; dni?: string | null } | null,
  ): { tipo: number; nro: number } {
    const cuit = this.soloDigitos(cliente?.cuit);
    if (cuit) return { tipo: 80, nro: Number(cuit) };

    const dni = this.soloDigitos(cliente?.dni);
    if (dni) return { tipo: 96, nro: Number(dni) };

    return { tipo: 99, nro: 0 };
  }

  /** YYYY-MM-DD en hora local: con toISOString() una venta nocturna cae al día siguiente */
  private fechaLocalISO(fecha: Date | string | null | undefined): string {
    const d = fecha ? new Date(fecha) : new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  private soloDigitos(valor: string | null | undefined): string {
    return String(valor ?? '').replace(/\D/g, '');
  }
}
