import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfiguracionEmailService } from 'src/configuracion/configuracion-email.service';
import { ConfiguracionSucursal } from 'src/configuracion/entities/configuracion.entity';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { PdfService } from 'src/pdf/pdf.service';
import { EmailTemplateService } from 'src/email/email-template.service';
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
    private readonly emailTemplates: EmailTemplateService,
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

    // 3.- Construir variables para la plantilla HTML
    const nombreCliente =
      cliente?.razon_social ||
      [cliente?.nombre, cliente?.apellido].filter(Boolean).join(' ') ||
      null;

    const formatPeso = (v: number) =>
      `$ ${v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const items = (comprobante.items ?? []).map((item) => ({
      descripcion: item.descripcion,
      cantidad: Number(item.cantidad).toLocaleString('es-AR', { maximumFractionDigits: 3 }),
      precioUnitario: formatPeso(Number(item.precio_unitario)),
      subtotal: formatPeso(Number(item.subtotal)),
    }));

    const descuentoTotal = Number(comprobante.descuento_total ?? 0);
    const recargoTotal = Number(comprobante.recargo_total ?? 0);

    const html = this.emailTemplates.renderizar('comprobante', {
      nombreEmpresa: configSucursal?.nombre_fantasia_ticket ?? configSucursal?.razon_social_ticket ?? 'ERP',
      cuitEmpresa: configSucursal?.cuit_ticket ?? null,
      domicilioEmpresa: configSucursal?.domicilio_ticket ?? null,
      tipoComprobante: tipoLabel,
      numeroComprobante: comprobante.numero,
      fechaEmision: new Date(comprobante.created_at).toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      }),
      nombreCliente,
      totalFormatted: formatPeso(Number(comprobante.total ?? 0)),
      cae: comprobante.cae ?? null,
      hayItems: items.length > 0,
      items,
      subtotalFormatted: formatPeso(Number(comprobante.subtotal ?? 0)),
      hayDescuento: descuentoTotal > 0,
      descuentoFormatted: formatPeso(descuentoTotal),
      hayRecargo: recargoTotal > 0,
      recargoFormatted: formatPeso(recargoTotal),
      tienePdf: true,
      mensajeComercial: configSucursal?.mensaje_boleta ?? configSucursal?.mensaje_ticket ?? dto.mensaje ?? null,
    });

    // 4.- Texto plano como fallback
    const text = this.buildComprobanteEmailText(comprobante, cliente, dto.mensaje);

    // 5.- Enviar email con HTML, texto plano y PDF adjunto
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

  private buildComprobanteEmailText(
    comprobante: Comprobante,
    cliente: Cliente | null,
    mensaje?: string | null,
  ): string {
    const clienteNombre =
      cliente?.razon_social ||
      [cliente?.nombre, cliente?.apellido].filter(Boolean).join(' ') ||
      'Consumidor final';
    const items = (comprobante.items ?? [])
      .map((item) => {
        const cantidad = Number(item.cantidad ?? 0);
        const precio = this.formatCurrency(Number(item.precio_unitario ?? 0));
        const subtotal = this.formatCurrency(Number(item.subtotal ?? 0));
        return `- ${item.descripcion} | Cant.: ${cantidad} | Unit.: ${precio} | Subtotal: ${subtotal}`;
      })
      .join('\n');

    return [
      mensaje?.trim() || 'Te enviamos el detalle de tu comprobante.',
      '',
      `${comprobante.tipo.replaceAll('_', ' ')} ${comprobante.numero}`,
      `Fecha: ${new Date(comprobante.created_at).toLocaleString('es-AR')}`,
      `Cliente: ${clienteNombre}`,
      '',
      'Detalle:',
      items || 'Sin items registrados.',
      '',
      `Subtotal: ${this.formatCurrency(Number(comprobante.subtotal ?? 0))}`,
      `Descuentos: ${this.formatCurrency(Number(comprobante.descuento_total ?? 0))}`,
      `Recargos: ${this.formatCurrency(Number(comprobante.recargo_total ?? 0))}`,
      `Total: ${this.formatCurrency(Number(comprobante.total ?? 0))}`,
      comprobante.observaciones ? `\nObservaciones: ${comprobante.observaciones}` : '',
      '',
      'Gracias por su compra.',
    ]
      .filter((line) => line !== null && line !== undefined)
      .join('\n');
  }

  private formatCurrency(value: number): string {
    return value.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 2,
    });
  }
}
