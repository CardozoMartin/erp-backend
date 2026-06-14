import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
import { Comprobante, TipoComprobante } from 'src/comprobantes/entities/comprobante.entity';
import { ConfiguracionSucursal } from 'src/configuracion/entities/configuracion.entity';
import { Cliente } from 'src/clientes/entities/cliente.entity';

// Paleta de colores y constantes de layout
const COLOR_PRIMARIO   = '#1a237e'; // azul oscuro
const COLOR_SECUNDARIO = '#3949ab'; // azul medio
const COLOR_LINEA      = '#e0e0e0'; // gris claro
const COLOR_TEXTO      = '#212121'; // casi negro
const COLOR_SUBTEXTO   = '#616161'; // gris
const MARGEN           = 50;
const ANCHO_UTIL       = 495; // 595 - 2 * 50

@Injectable()
export class PdfService {
  constructor(
    @InjectRepository(Comprobante)
    private readonly comprobanteRepo: Repository<Comprobante>,
    @InjectRepository(ConfiguracionSucursal)
    private readonly configRepo: Repository<ConfiguracionSucursal>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
  ) {}

  // 1.- Punto de entrada público: busca el comprobante y genera el PDF
  async generarComprobantePdf(comprobanteId: string, sucursalId: string): Promise<Buffer> {
    const comprobante = await this.comprobanteRepo.findOne({
      where: { id: comprobanteId, sucursal_id: sucursalId },
      relations: ['items'],
    });
    if (!comprobante) {
      throw new NotFoundException(`Comprobante ${comprobanteId} no encontrado`);
    }

    // 2.- Carga datos relacionados en paralelo
    const [config, cliente] = await Promise.all([
      this.configRepo.findOne({ where: { sucursal_id: sucursalId } }),
      comprobante.cliente_id
        ? this.clienteRepo.findOne({ where: { id: comprobante.cliente_id } })
        : Promise.resolve(null),
    ]);

    return this.construirPdf(comprobante, config ?? null, cliente ?? null);
  }

  // 3.- Construye el documento PDF y lo retorna como Buffer
  private construirPdf(
    comprobante: Comprobante,
    config: ConfiguracionSucursal | null,
    cliente: Cliente | null,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: MARGEN });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // 4.- Dibuja las secciones del comprobante
      this.dibujarEncabezado(doc, comprobante, config);
      this.dibujarDatosCliente(doc, cliente);
      this.dibujarTablaItems(doc, comprobante);
      this.dibujarTotales(doc, comprobante);
      this.dibujarPiePagina(doc, comprobante, config);

      doc.end();
    });
  }

  // 5.- Encabezado: datos del negocio + tipo/número de comprobante
  private dibujarEncabezado(
    doc: PDFKit.PDFDocument,
    comprobante: Comprobante,
    config: ConfiguracionSucursal | null,
  ) {
    const y = MARGEN;

    // Bloque izquierdo — datos del emisor
    doc
      .fontSize(18)
      .fillColor(COLOR_PRIMARIO)
      .font('Helvetica-Bold')
      .text(config?.nombre_fantasia_ticket ?? config?.razon_social_ticket ?? 'ERP', MARGEN, y);

    let yIzq = y + 24;
    if (config?.razon_social_ticket) {
      doc.fontSize(9).fillColor(COLOR_SUBTEXTO).font('Helvetica')
        .text(config.razon_social_ticket, MARGEN, yIzq);
      yIzq += 13;
    }
    if (config?.cuit_ticket) {
      doc.fontSize(9).fillColor(COLOR_SUBTEXTO)
        .text(`CUIT: ${config.cuit_ticket}`, MARGEN, yIzq);
      yIzq += 13;
    }
    if (config?.domicilio_ticket) {
      doc.fontSize(9).fillColor(COLOR_SUBTEXTO)
        .text(config.domicilio_ticket, MARGEN, yIzq);
      yIzq += 13;
    }
    if (config?.telefono_ticket) {
      doc.fontSize(9).fillColor(COLOR_SUBTEXTO)
        .text(`Tel: ${config.telefono_ticket}`, MARGEN, yIzq);
      yIzq += 13;
    }
    if (config?.ingresos_brutos_ticket) {
      doc.fontSize(9).fillColor(COLOR_SUBTEXTO)
        .text(`IIBB: ${config.ingresos_brutos_ticket}`, MARGEN, yIzq);
      yIzq += 13;
    }

    // Bloque derecho — tipo y número de comprobante
    const xDer = MARGEN + ANCHO_UTIL - 180;
    doc
      .roundedRect(xDer, y - 5, 185, 60, 6)
      .fillAndStroke('#f3f4ff', COLOR_SECUNDARIO);

    doc
      .fontSize(13)
      .fillColor(COLOR_PRIMARIO)
      .font('Helvetica-Bold')
      .text(this.labelTipo(comprobante.tipo), xDer, y + 4, { width: 185, align: 'center' });

    doc
      .fontSize(11)
      .fillColor(COLOR_TEXTO)
      .font('Helvetica')
      .text(comprobante.numero, xDer, y + 22, { width: 185, align: 'center' });

    const fecha = new Date(comprobante.created_at).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
    doc
      .fontSize(9)
      .fillColor(COLOR_SUBTEXTO)
      .text(`Fecha: ${fecha}`, xDer, y + 40, { width: 185, align: 'center' });

    // Línea divisoria
    const yLinea = Math.max(yIzq, y + 65) + 8;
    doc.moveTo(MARGEN, yLinea).lineTo(MARGEN + ANCHO_UTIL, yLinea)
      .strokeColor(COLOR_LINEA).lineWidth(1).stroke();

    doc.y = yLinea + 10;
  }

  // 6.- Datos del cliente receptor
  private dibujarDatosCliente(doc: PDFKit.PDFDocument, cliente: Cliente | null) {
    if (!cliente) return;

    const y = doc.y;
    doc
      .fontSize(9).font('Helvetica-Bold').fillColor(COLOR_PRIMARIO)
      .text('DATOS DEL CLIENTE', MARGEN, y);

    doc.moveDown(0.3);
    const nombreCompleto = [cliente.nombre, cliente.apellido].filter(Boolean).join(' ');
    const lineas = [
      nombreCompleto || cliente.razon_social,
      cliente.cuit ? `CUIT: ${cliente.cuit}` : cliente.dni ? `DNI: ${cliente.dni}` : null,
      cliente.direccion,
      cliente.email,
      cliente.telefono ? `Tel: ${cliente.telefono}` : null,
    ].filter(Boolean) as string[];

    for (const linea of lineas) {
      doc.fontSize(9).font('Helvetica').fillColor(COLOR_TEXTO).text(linea, MARGEN, doc.y);
    }

    doc
      .moveTo(MARGEN, doc.y + 6)
      .lineTo(MARGEN + ANCHO_UTIL, doc.y + 6)
      .strokeColor(COLOR_LINEA).lineWidth(1).stroke();

    doc.y = doc.y + 14;
  }

  // 7.- Tabla de ítems del comprobante
  private dibujarTablaItems(doc: PDFKit.PDFDocument, comprobante: Comprobante) {
    const y = doc.y;
    const colDesc  = MARGEN;
    const colCant  = MARGEN + 270;
    const colPrecio = MARGEN + 340;
    const colTotal = MARGEN + 420;

    // Encabezado de tabla
    doc.rect(MARGEN, y, ANCHO_UTIL, 18).fill(COLOR_PRIMARIO);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('Descripción',        colDesc  + 4, y + 4, { width: 265 });
    doc.text('Cant.',               colCant,      y + 4, { width: 65, align: 'right' });
    doc.text('P. Unit.',            colPrecio,    y + 4, { width: 75, align: 'right' });
    doc.text('Subtotal',            colTotal,     y + 4, { width: 75, align: 'right' });

    let yFila = y + 20;
    let filaAlterna = false;

    for (const item of comprobante.items) {
      // Fila con fondo alternado
      if (filaAlterna) {
        doc.rect(MARGEN, yFila, ANCHO_UTIL, 16).fill('#f9f9f9');
      }
      filaAlterna = !filaAlterna;

      doc.fontSize(9).font('Helvetica').fillColor(COLOR_TEXTO);
      doc.text(item.descripcion,                   colDesc  + 4, yFila + 3, { width: 260 });
      doc.text(this.formatNum(item.cantidad, 3),   colCant,      yFila + 3, { width: 65,  align: 'right' });
      doc.text(this.formatPeso(item.precio_unitario), colPrecio, yFila + 3, { width: 75,  align: 'right' });
      doc.text(this.formatPeso(item.subtotal),     colTotal,     yFila + 3, { width: 75,  align: 'right' });

      // Descuento por ítem
      if (Number(item.descuento_porcentaje) > 0) {
        yFila += 16;
        doc.fontSize(8).fillColor(COLOR_SUBTEXTO)
          .text(`  Desc. ${this.formatNum(item.descuento_porcentaje, 2)}%  (-${this.formatPeso(item.descuento_monto)})`,
            colDesc + 4, yFila + 2, { width: ANCHO_UTIL - 8 });
      }

      yFila += 16;

      // Salto de página si queda poco espacio
      if (yFila > 700) {
        doc.addPage();
        yFila = MARGEN;
      }
    }

    // Línea cierre tabla
    doc.moveTo(MARGEN, yFila).lineTo(MARGEN + ANCHO_UTIL, yFila)
      .strokeColor(COLOR_LINEA).lineWidth(1).stroke();

    doc.y = yFila + 6;
  }

  // 8.- Bloque de totales
  private dibujarTotales(doc: PDFKit.PDFDocument, comprobante: Comprobante) {
    const xLabel = MARGEN + 320;
    const xValor = MARGEN + 420;
    const anchoLabel = 95;
    const anchoValor = 75;

    let y = doc.y + 4;

    const fila = (label: string, valor: string, negrita = false) => {
      doc
        .fontSize(9)
        .font(negrita ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(negrita ? COLOR_PRIMARIO : COLOR_TEXTO)
        .text(label, xLabel, y, { width: anchoLabel, align: 'right' })
        .text(valor, xValor, y, { width: anchoValor, align: 'right' });
      y += 14;
    };

    fila('Subtotal:', this.formatPeso(comprobante.subtotal));

    if (Number(comprobante.descuento_total) > 0) {
      fila('Descuento:', `-${this.formatPeso(comprobante.descuento_total)}`);
    }
    if (Number(comprobante.recargo_total) > 0) {
      fila('Recargo:', `+${this.formatPeso(comprobante.recargo_total)}`);
    }

    // Línea antes del total
    doc.moveTo(xLabel, y).lineTo(MARGEN + ANCHO_UTIL, y)
      .strokeColor(COLOR_SECUNDARIO).lineWidth(1).stroke();
    y += 4;

    fila('TOTAL:', this.formatPeso(comprobante.total), true);

    // Observaciones
    if (comprobante.observaciones) {
      doc.y = y + 10;
      doc.fontSize(9).font('Helvetica-Bold').fillColor(COLOR_PRIMARIO)
        .text('Observaciones:', MARGEN, doc.y);
      doc.fontSize(9).font('Helvetica').fillColor(COLOR_TEXTO)
        .text(comprobante.observaciones, MARGEN, doc.y + 2, { width: ANCHO_UTIL });
    }

    doc.y = y + 10;
  }

  // 9.- Pie de página: CAE, mensaje, número de página
  private dibujarPiePagina(
    doc: PDFKit.PDFDocument,
    comprobante: Comprobante,
    config: ConfiguracionSucursal | null,
  ) {
    const yPie = 780;

    doc.moveTo(MARGEN, yPie).lineTo(MARGEN + ANCHO_UTIL, yPie)
      .strokeColor(COLOR_LINEA).lineWidth(1).stroke();

    let y = yPie + 6;

    // CAE si existe
    if (comprobante.cae) {
      const vto = comprobante.cae_vencimiento
        ? new Date(comprobante.cae_vencimiento).toLocaleDateString('es-AR')
        : '';
      doc.fontSize(8).font('Helvetica').fillColor(COLOR_SUBTEXTO)
        .text(`CAE: ${comprobante.cae}  |  Vto. CAE: ${vto}`, MARGEN, y);
      y += 12;
    }

    // Mensaje personalizado
    const mensaje = config?.mensaje_boleta ?? config?.mensaje_ticket;
    if (mensaje) {
      doc.fontSize(8).font('Helvetica').fillColor(COLOR_SUBTEXTO)
        .text(mensaje, MARGEN, y, { width: ANCHO_UTIL, align: 'center' });
      y += 12;
    }

    // Número de página
    doc.fontSize(8).fillColor(COLOR_SUBTEXTO)
      .text('Página 1 de 1', MARGEN, y, { width: ANCHO_UTIL, align: 'right' });
  }

  // --- Helpers ---

  private labelTipo(tipo: TipoComprobante): string {
    const labels: Record<TipoComprobante, string> = {
      [TipoComprobante.TICKET]:       'TICKET',
      [TipoComprobante.VENTA]:        'COMPROBANTE DE VENTA',
      [TipoComprobante.COTIZACION]:   'COTIZACIÓN',
      [TipoComprobante.FACTURA_A]:    'FACTURA A',
      [TipoComprobante.FACTURA_B]:    'FACTURA B',
      [TipoComprobante.FACTURA_C]:    'FACTURA C',
      [TipoComprobante.REMITO]:       'REMITO',
      [TipoComprobante.NOTA_CREDITO]: 'NOTA DE CRÉDITO',
    };
    return labels[tipo] ?? tipo;
  }

  private formatPeso(valor: number | string): string {
    return `$ ${Number(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private formatNum(valor: number | string, decimales: number): string {
    return Number(valor).toLocaleString('es-AR', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    });
  }
}
