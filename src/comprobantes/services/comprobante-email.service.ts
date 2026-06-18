import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfiguracionEmailService } from 'src/configuracion/configuracion-email.service';
import { ConfiguracionSucursal } from 'src/configuracion/entities/configuracion.entity';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { PdfService } from 'src/pdf/pdf.service';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { EnviarComprobanteEmailDto } from '../dto/enviar-comprobante-email.dto';
import { Comprobante } from '../entities/comprobante.entity';

@Injectable()
export class ComprobanteEmailService {
  constructor(
    @InjectRepository(ConfiguracionSucursal)
    private readonly configSucursalRepo: Repository<ConfiguracionSucursal>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    private readonly configuracionEmailService: ConfiguracionEmailService,
    private readonly auditoriaService: AuditoriaService,
    private readonly pdfService: PdfService,
  ) {}

  async enviarPorEmail(
    comprobante: Comprobante,
    sucursalId: string,
    dto: EnviarComprobanteEmailDto,
    empleadoId?: string | null,
  ) {
    // 1.- Cargar config de sucursal y cliente en paralelo
    const [configSucursal, cliente] = await Promise.all([
      this.configSucursalRepo.findOne({ where: { sucursal_id: sucursalId } }),
      comprobante.cliente_id
        ? this.clienteRepo.findOne({ where: { id: comprobante.cliente_id } })
        : Promise.resolve(null),
    ]);

    const destino = dto.destino.trim().toLowerCase();
    const tipoLabel = comprobante.tipo.replaceAll('_', ' ');
    const asunto = dto.asunto?.trim() || `${tipoLabel} ${comprobante.numero}`;

    // 2.- Generar PDF server-side
    const pdfBuffer = await this.pdfService.generarComprobantePdf(comprobante.id, sucursalId);

    // 3.- Datos básicos para el cuerpo del email
    const nombreEmpresa = configSucursal?.nombre_fantasia_ticket ?? configSucursal?.razon_social_ticket ?? 'ERP';
    const nombreCliente =
      cliente?.razon_social ||
      [cliente?.nombre, cliente?.apellido].filter(Boolean).join(' ') ||
      'Consumidor final';
    const mensajeComercial =
      dto.mensaje?.trim() ||
      configSucursal?.mensaje_boleta ||
      configSucursal?.mensaje_ticket ||
      'Gracias por su compra.';

    // 4.- HTML simple: empresa, saludo, tipo de comprobante y mensaje
    const html = this.buildHtmlSimple({ nombreEmpresa, nombreCliente, tipoLabel, numero: comprobante.numero, mensajeComercial });
    const text = `${nombreEmpresa}\n\nEstimado/a ${nombreCliente},\n\nAdjuntamos su ${tipoLabel} N° ${comprobante.numero}.\n\n${mensajeComercial}`;

    // 5.- Enviar email con cuerpo simple y PDF adjunto
    await this.configuracionEmailService.enviarCorreoSucursal(sucursalId, {
      to: destino,
      subject: asunto,
      text,
      html,
      attachments: [{
        filename: `comprobante-${comprobante.numero}.pdf`,
        contentType: 'application/pdf',
        content: pdfBuffer,
      }],
    });

    await this.auditoriaService.registrar({
      modulo: 'comprobantes',
      accion: 'ENVIAR_COMPROBANTE_EMAIL',
      entidad: 'comprobante',
      entidad_id: comprobante.id,
      empleado_id: empleadoId ?? null,
      sucursal_id: sucursalId,
      descripcion: `Comprobante ${comprobante.numero} enviado por email a ${destino}`,
      metadata: {
        destino,
        tipo: comprobante.tipo,
        numero: comprobante.numero,
        total: Number(comprobante.total ?? 0),
        con_pdf: true,
        con_html: true,
      },
    });

    return { ok: true, message: `Comprobante enviado a ${destino}` };
  }

  private buildHtmlSimple(opts: {
    nombreEmpresa: string;
    nombreCliente: string;
    tipoLabel: string;
    numero: string;
    mensajeComercial: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#1a1a2e;padding:28px 32px;text-align:center;">
          <span style="color:#ffffff;font-size:22px;font-weight:700;">${opts.nombreEmpresa}</span>
        </td></tr>
        <tr><td style="padding:36px 32px;">
          <p style="margin:0 0 12px;color:#333;font-size:15px;">Estimado/a <strong>${opts.nombreCliente}</strong>,</p>
          <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">
            Adjuntamos su <strong>${opts.tipoLabel} N° ${opts.numero}</strong> en formato PDF.
          </p>
          <p style="margin:0;color:#777;font-size:13px;line-height:1.6;">${opts.mensajeComercial}</p>
        </td></tr>
        <tr><td style="background:#f9f9f9;padding:16px 32px;text-align:center;border-top:1px solid #eee;">
          <span style="color:#aaa;font-size:11px;">${opts.nombreEmpresa}</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }
}
