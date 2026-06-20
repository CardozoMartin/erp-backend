import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
import { Comprobante, TipoComprobante } from 'src/comprobantes/entities/comprobante.entity';
import { ConfiguracionSucursal } from 'src/configuracion/entities/configuracion.entity';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Empleado } from 'src/empleados/entities/empleado.entity';

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
    @InjectRepository(Empleado)
    private readonly empleadoRepo: Repository<Empleado>,
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

  // ─── PDF Resumen Cuenta Corriente ────────────────────────────────────────────

  generarResumenCuentaCorrientePdf(
    cliente: Cliente,
    movimientos: import('src/clientes/entities/movimiento-cuenta-corriente.entity').MovimientoCuentaCorriente[],
    opciones: { periodo: string; tipoResumen: string; mensaje?: string; config: ConfiguracionSucursal | null },
  ): Promise<Buffer> {
    const { config } = opciones;
    const cc = (cliente as any).cuentaCorriente as { saldo?: number; limite_credito?: number } | undefined;
    const saldo = Number(cc?.saldo ?? 0);
    const limite = Number(cc?.limite_credito ?? 0);

    const ordenados = [...movimientos].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
    );

    let acumuladoCargos = 0;
    let acumuladoPagos = 0;
    for (const m of movimientos) {
      const n = Number(m.monto ?? 0);
      if (n > 0) acumuladoCargos += n;
      else acumuladoPagos += Math.abs(n);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: MARGEN });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Encabezado ───────────────────────────────────────────────────────────
      const nombreNegocio = config?.nombre_fantasia_ticket ?? config?.razon_social_ticket ?? 'ERP';
      doc.fontSize(18).fillColor(COLOR_PRIMARIO).font('Helvetica-Bold')
        .text(nombreNegocio, MARGEN, MARGEN);

      let yIzq = MARGEN + 24;
      if (config?.domicilio_ticket) {
        doc.fontSize(9).fillColor(COLOR_SUBTEXTO).font('Helvetica')
          .text(config.domicilio_ticket, MARGEN, yIzq);
        yIzq += 13;
      }

      const xDer = MARGEN + ANCHO_UTIL - 185;
      doc.roundedRect(xDer, MARGEN - 5, 190, 70, 6).fillAndStroke('#f3f4ff', COLOR_SECUNDARIO);
      doc.fontSize(12).fillColor(COLOR_PRIMARIO).font('Helvetica-Bold')
        .text('RESUMEN DE CUENTA', xDer, MARGEN + 4, { width: 190, align: 'center' });
      doc.fontSize(9).fillColor(COLOR_SUBTEXTO).font('Helvetica')
        .text(opciones.tipoResumen, xDer, MARGEN + 21, { width: 190, align: 'center' })
        .text(`Período: ${opciones.periodo}`, xDer, MARGEN + 35, { width: 190, align: 'center' })
        .text(`Emitido: ${new Date().toLocaleDateString('es-AR')}`, xDer, MARGEN + 49, { width: 190, align: 'center' });

      const yLinea1 = Math.max(yIzq, MARGEN + 72) + 6;
      doc.moveTo(MARGEN, yLinea1).lineTo(MARGEN + ANCHO_UTIL, yLinea1)
        .strokeColor(COLOR_LINEA).lineWidth(1).stroke();

      // ── Datos del cliente ─────────────────────────────────────────────────────
      let y = yLinea1 + 10;
      doc.fontSize(9).font('Helvetica-Bold').fillColor(COLOR_PRIMARIO)
        .text('CLIENTE', MARGEN, y);
      y += 13;
      const nombreCliente = [cliente.nombre, cliente.apellido].filter(Boolean).join(' ')
        || cliente.razon_social || 'Sin nombre';
      doc.fontSize(9).font('Helvetica').fillColor(COLOR_TEXTO).text(nombreCliente, MARGEN, y);
      y += 13;
      const doc_cliente = cliente.cuit ? `CUIT: ${cliente.cuit}` : cliente.dni ? `DNI: ${cliente.dni}` : null;
      if (doc_cliente) { doc.text(doc_cliente, MARGEN, y); y += 13; }
      if (cliente.email) { doc.fillColor(COLOR_SUBTEXTO).text(cliente.email, MARGEN, y); y += 13; }

      // ── Resumen saldo ─────────────────────────────────────────────────────────
      const xSaldo = MARGEN + 280;
      const colorSaldo = saldo > 0 ? '#b71c1c' : '#1b5e20';
      doc.rect(xSaldo, yLinea1 + 10, ANCHO_UTIL - 280, 62).fillAndStroke('#f9f9fb', COLOR_LINEA);
      doc.fontSize(9).font('Helvetica').fillColor(COLOR_SUBTEXTO)
        .text('Total cargos del período:', xSaldo + 8, yLinea1 + 16, { width: 200 })
        .text(this.formatPeso(acumuladoCargos), xSaldo + 8, yLinea1 + 16, { width: ANCHO_UTIL - 296, align: 'right' });
      doc.fontSize(9).font('Helvetica').fillColor(COLOR_SUBTEXTO)
        .text('Total pagos/créditos:', xSaldo + 8, yLinea1 + 30, { width: 200 })
        .text(this.formatPeso(acumuladoPagos), xSaldo + 8, yLinea1 + 30, { width: ANCHO_UTIL - 296, align: 'right' });
      if (limite > 0) {
        doc.fontSize(9).font('Helvetica').fillColor(COLOR_SUBTEXTO)
          .text('Límite de crédito:', xSaldo + 8, yLinea1 + 44, { width: 200 })
          .text(this.formatPeso(limite), xSaldo + 8, yLinea1 + 44, { width: ANCHO_UTIL - 296, align: 'right' });
      }
      doc.fontSize(11).font('Helvetica-Bold').fillColor(COLOR_PRIMARIO)
        .text('Saldo actual:', xSaldo + 8, yLinea1 + (limite > 0 ? 58 : 46), { width: 150 });
      doc.fontSize(11).font('Helvetica-Bold').fillColor(colorSaldo)
        .text(this.formatPeso(Math.abs(saldo)) + (saldo > 0 ? ' (deuda)' : ' (a favor)'),
          xSaldo + 8, yLinea1 + (limite > 0 ? 58 : 46), { width: ANCHO_UTIL - 296, align: 'right' });

      y = Math.max(y, yLinea1 + 80) + 8;
      doc.moveTo(MARGEN, y).lineTo(MARGEN + ANCHO_UTIL, y)
        .strokeColor(COLOR_LINEA).lineWidth(1).stroke();
      y += 12;

      // ── Tabla de movimientos ──────────────────────────────────────────────────
      if (opciones.mensaje) {
        doc.fontSize(9).font('Helvetica').fillColor(COLOR_SUBTEXTO)
          .text(opciones.mensaje, MARGEN, y, { width: ANCHO_UTIL });
        y = doc.y + 8;
      }

      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLOR_PRIMARIO)
        .text('DETALLE DE MOVIMIENTOS', MARGEN, y);
      y += 16;

      const colFecha = MARGEN;
      const colDesc  = MARGEN + 80;
      const colTipo  = MARGEN + 295;
      const colMonto = MARGEN + 375;
      const colAcum  = MARGEN + 435;

      doc.rect(MARGEN, y, ANCHO_UTIL, 18).fill(COLOR_PRIMARIO);
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('Fecha',      colFecha + 4,  y + 4, { width: 74 });
      doc.text('Descripción', colDesc + 4,  y + 4, { width: 209 });
      doc.text('Tipo',        colTipo + 4,  y + 4, { width: 78 });
      doc.text('Importe',     colMonto + 4, y + 4, { width: 58, align: 'right' });
      doc.text('Acumulado',   colAcum + 4,  y + 4, { width: 58, align: 'right' });
      y += 20;

      let acum = 0;
      let alterna = false;

      for (const m of ordenados) {
        const items = m.comprobante?.items ?? [];
        const filas = items.length
          ? items.map(item => ({
              desc: `${Number(item.cantidad)} x ${item.descripcion}`,
              monto: Number(item.subtotal ?? 0),
            }))
          : [{ desc: m.descripcion || m.tipo, monto: Number(m.monto ?? 0) }];

        for (const fila of filas) {
          if (y > 740) {
            doc.addPage();
            y = MARGEN;
            doc.rect(MARGEN, y, ANCHO_UTIL, 18).fill(COLOR_PRIMARIO);
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
            doc.text('Fecha', colFecha + 4, y + 4, { width: 74 });
            doc.text('Descripción', colDesc + 4, y + 4, { width: 209 });
            doc.text('Tipo', colTipo + 4, y + 4, { width: 78 });
            doc.text('Importe', colMonto + 4, y + 4, { width: 58, align: 'right' });
            doc.text('Acumulado', colAcum + 4, y + 4, { width: 58, align: 'right' });
            y += 20;
            alterna = false;
          }

          acum += fila.monto;
          if (alterna) doc.rect(MARGEN, y, ANCHO_UTIL, 16).fill('#f9f9f9');
          alterna = !alterna;

          const colorMonto = fila.monto >= 0 ? '#b71c1c' : '#1b5e20';
          const fecha = new Date(m.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });

          doc.fontSize(8).font('Helvetica').fillColor(COLOR_TEXTO);
          doc.text(fecha,   colFecha + 4,  y + 3, { width: 74 });
          doc.text(fila.desc, colDesc + 4, y + 3, { width: 209 });
          doc.text(m.tipo,  colTipo + 4,   y + 3, { width: 78 });
          doc.fillColor(colorMonto)
            .text(this.formatPeso(fila.monto), colMonto + 4, y + 3, { width: 58, align: 'right' });
          doc.fillColor(acum >= 0 ? '#b71c1c' : '#1b5e20')
            .text(this.formatPeso(acum), colAcum + 4, y + 3, { width: 58, align: 'right' });
          y += 16;
        }
      }

      // Fila totales
      doc.rect(MARGEN, y, ANCHO_UTIL, 22).fill('#e8eaf6');
      doc.fontSize(9).font('Helvetica-Bold').fillColor(COLOR_PRIMARIO)
        .text('SALDO ACTUAL', colFecha + 4, y + 5, { width: 430 })
        .text(this.formatPeso(saldo), colAcum + 4, y + 5, { width: 58, align: 'right' });
      y += 32;

      // ── Pie ──────────────────────────────────────────────────────────────────
      const yPie = Math.max(y + 10, 780);
      doc.moveTo(MARGEN, yPie).lineTo(MARGEN + ANCHO_UTIL, yPie)
        .strokeColor(COLOR_LINEA).lineWidth(1).stroke();
      doc.fontSize(8).fillColor(COLOR_SUBTEXTO)
        .text(
          `${nombreNegocio}  |  Generado: ${new Date().toLocaleString('es-AR')}`,
          MARGEN, yPie + 6,
          { width: ANCHO_UTIL, align: 'center' },
        );

      doc.end();
    });
  }

  // ─── PDF Cierre de Caja ──────────────────────────────────────────────────────

  async generarCierreCajaPdfConDatos(
    resumen: {
      caja: import('src/caja/entities/caja.entity').Caja;
      totales: {
        apertura: number; cobros: number; ingresos_manuales: number;
        egresos: number; ajustes: number; calculado: number;
        declarado: number | null; diferencia: number | null;
      };
      cobros_por_medio: { medio: string; total: number; cantidad: number }[];
    },
    sucursalId: string,
  ): Promise<Buffer> {
    const [config, empleado] = await Promise.all([
      this.configRepo.findOne({ where: { sucursal_id: sucursalId } }),
      this.empleadoRepo.findOne({ where: { id: resumen.caja.empleado_id } }),
    ]);
    return this.generarCierreCajaPdf(resumen, config ?? null, empleado ?? null);
  }

  async generarCierreCajaPdf(
    resumen: {
      caja: import('src/caja/entities/caja.entity').Caja;
      totales: {
        apertura: number;
        cobros: number;
        ingresos_manuales: number;
        egresos: number;
        ajustes: number;
        calculado: number;
        declarado: number | null;
        diferencia: number | null;
      };
      cobros_por_medio: { medio: string; total: number; cantidad: number }[];
    },
    config: ConfiguracionSucursal | null,
    empleado: Empleado | null,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: MARGEN });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.dibujarEncabezadoCaja(doc, resumen.caja, config, empleado);
      this.dibujarResumenCaja(doc, resumen.totales);
      this.dibujarCobrosporMedioCaja(doc, resumen.cobros_por_medio);
      this.dibujarDiferenciaCaja(doc, resumen.totales);
      this.dibujarFirmasCaja(doc);
      this.dibujarPieCaja(doc, config);

      doc.end();
    });
  }

  private dibujarEncabezadoCaja(
    doc: PDFKit.PDFDocument,
    caja: import('src/caja/entities/caja.entity').Caja,
    config: ConfiguracionSucursal | null,
    empleado: Empleado | null,
  ) {
    const y = MARGEN;

    // Nombre del negocio
    doc.fontSize(18).fillColor(COLOR_PRIMARIO).font('Helvetica-Bold')
      .text(config?.nombre_fantasia_ticket ?? config?.razon_social_ticket ?? 'ERP', MARGEN, y);

    let yIzq = y + 24;
    if (config?.razon_social_ticket) {
      doc.fontSize(9).fillColor(COLOR_SUBTEXTO).font('Helvetica')
        .text(config.razon_social_ticket, MARGEN, yIzq);
      yIzq += 13;
    }
    if (config?.domicilio_ticket) {
      doc.fontSize(9).fillColor(COLOR_SUBTEXTO)
        .text(config.domicilio_ticket, MARGEN, yIzq);
      yIzq += 13;
    }

    // Bloque derecho — tipo de documento
    const xDer = MARGEN + ANCHO_UTIL - 180;
    doc.roundedRect(xDer, y - 5, 185, 70, 6).fillAndStroke('#f3f4ff', COLOR_SECUNDARIO);

    doc.fontSize(13).fillColor(COLOR_PRIMARIO).font('Helvetica-Bold')
      .text('RESUMEN DE CAJA', xDer, y + 4, { width: 185, align: 'center' });

    doc.fontSize(10).fillColor(COLOR_TEXTO).font('Helvetica')
      .text(caja.estado, xDer, y + 22, { width: 185, align: 'center' });

    const fechaApertura = new Date(caja.fecha_apertura).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
    doc.fontSize(9).fillColor(COLOR_SUBTEXTO)
      .text(`Apertura: ${fechaApertura}`, xDer, y + 38, { width: 185, align: 'center' });

    if (caja.fecha_cierre) {
      const fechaCierre = new Date(caja.fecha_cierre).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      doc.fontSize(9).fillColor(COLOR_SUBTEXTO)
        .text(`Cierre: ${fechaCierre}`, xDer, y + 52, { width: 185, align: 'center' });
    }

    // Datos del cajero
    const yCajero = Math.max(yIzq, y + 78) + 6;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLOR_PRIMARIO)
      .text('CAJERO', MARGEN, yCajero);
    doc.fontSize(9).font('Helvetica').fillColor(COLOR_TEXTO)
      .text(empleado?.nombreCompleto ?? `ID: ${caja.empleado_id.slice(0, 8)}`, MARGEN, yCajero + 13);

    // Horario del turno
    const apertura = new Date(caja.fecha_apertura);
    const cierre = caja.fecha_cierre ? new Date(caja.fecha_cierre) : new Date();
    const minutosTurno = Math.round((cierre.getTime() - apertura.getTime()) / 60000);
    const horas = Math.floor(minutosTurno / 60);
    const minutos = minutosTurno % 60;
    doc.fontSize(9).fillColor(COLOR_SUBTEXTO)
      .text(
        `Turno: ${apertura.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` +
        ` → ${cierre.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` +
        `  (${horas}h ${minutos}m)`,
        MARGEN, yCajero + 26,
      );

    const yLinea = yCajero + 44;
    doc.moveTo(MARGEN, yLinea).lineTo(MARGEN + ANCHO_UTIL, yLinea)
      .strokeColor(COLOR_LINEA).lineWidth(1).stroke();

    doc.y = yLinea + 12;
  }

  private dibujarResumenCaja(
    doc: PDFKit.PDFDocument,
    totales: {
      apertura: number;
      cobros: number;
      ingresos_manuales: number;
      egresos: number;
      ajustes: number;
      calculado: number;
    },
  ) {
    const y = doc.y;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLOR_PRIMARIO)
      .text('MOVIMIENTOS DEL TURNO', MARGEN, y);

    const yTabla = y + 16;
    doc.rect(MARGEN, yTabla, ANCHO_UTIL, 18).fill(COLOR_PRIMARIO);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('Concepto', MARGEN + 6, yTabla + 4, { width: 350 });
    doc.text('Importe', MARGEN + 356, yTabla + 4, { width: 135, align: 'right' });

    const filas = [
      { label: 'Monto apertura (fondo de caja)', valor: totales.apertura, color: COLOR_TEXTO },
      { label: 'Total cobros', valor: totales.cobros, color: '#1b5e20' },
      { label: 'Ingresos manuales', valor: totales.ingresos_manuales, color: '#1b5e20' },
      { label: 'Egresos', valor: -totales.egresos, color: '#b71c1c' },
      { label: 'Ajustes', valor: totales.ajustes, color: totales.ajustes >= 0 ? '#1b5e20' : '#b71c1c' },
    ];

    let yFila = yTabla + 20;
    let alterna = false;
    for (const f of filas) {
      if (alterna) doc.rect(MARGEN, yFila, ANCHO_UTIL, 18).fill('#f9f9f9');
      alterna = !alterna;
      doc.fontSize(9).font('Helvetica').fillColor(COLOR_TEXTO)
        .text(f.label, MARGEN + 6, yFila + 4, { width: 350 });
      doc.fontSize(9).font('Helvetica').fillColor(f.color)
        .text(this.formatPeso(Math.abs(f.valor)), MARGEN + 356, yFila + 4, { width: 135, align: 'right' });
      yFila += 18;
    }

    // Total calculado
    doc.rect(MARGEN, yFila, ANCHO_UTIL, 22).fill('#e8eaf6');
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLOR_PRIMARIO)
      .text('Total calculado en caja', MARGEN + 6, yFila + 5, { width: 350 });
    doc.text(this.formatPeso(totales.calculado), MARGEN + 356, yFila + 5, { width: 135, align: 'right' });

    doc.y = yFila + 32;
  }

  private dibujarCobrosporMedioCaja(
    doc: PDFKit.PDFDocument,
    cobros: { medio: string; total: number; cantidad: number }[],
  ) {
    if (!cobros.length) return;

    const y = doc.y + 4;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLOR_PRIMARIO)
      .text('COBROS POR MEDIO DE PAGO', MARGEN, y);

    const yTabla = y + 16;
    doc.rect(MARGEN, yTabla, ANCHO_UTIL, 18).fill(COLOR_SECUNDARIO);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('Medio de pago', MARGEN + 6, yTabla + 4, { width: 280 });
    doc.text('Transacciones', MARGEN + 286, yTabla + 4, { width: 100, align: 'center' });
    doc.text('Total', MARGEN + 386, yTabla + 4, { width: 105, align: 'right' });

    let yFila = yTabla + 20;
    let alterna = false;
    for (const c of cobros) {
      if (alterna) doc.rect(MARGEN, yFila, ANCHO_UTIL, 18).fill('#f9f9f9');
      alterna = !alterna;
      doc.fontSize(9).font('Helvetica').fillColor(COLOR_TEXTO)
        .text(c.medio, MARGEN + 6, yFila + 4, { width: 280 })
        .text(String(c.cantidad), MARGEN + 286, yFila + 4, { width: 100, align: 'center' })
        .text(this.formatPeso(c.total), MARGEN + 386, yFila + 4, { width: 105, align: 'right' });
      yFila += 18;
    }

    doc.y = yFila + 10;
  }

  private dibujarDiferenciaCaja(
    doc: PDFKit.PDFDocument,
    totales: { calculado: number; declarado: number | null; diferencia: number | null },
  ) {
    if (totales.declarado === null) return;

    const y = doc.y + 4;
    const diferencia = totales.diferencia ?? 0;
    const colorDif = diferencia === 0 ? '#1b5e20' : '#b71c1c';

    doc.rect(MARGEN, y, ANCHO_UTIL, 56).fillAndStroke('#f3f4ff', COLOR_SECUNDARIO);

    doc.fontSize(9).font('Helvetica').fillColor(COLOR_TEXTO)
      .text('Monto calculado:', MARGEN + 12, y + 8, { width: 280 })
      .text(this.formatPeso(totales.calculado), MARGEN + 292, y + 8, { width: 199, align: 'right' });

    doc.fontSize(9).font('Helvetica').fillColor(COLOR_TEXTO)
      .text('Monto declarado:', MARGEN + 12, y + 22, { width: 280 })
      .text(this.formatPeso(totales.declarado), MARGEN + 292, y + 22, { width: 199, align: 'right' });

    doc.moveTo(MARGEN + 292, y + 36).lineTo(MARGEN + ANCHO_UTIL - 4, y + 36)
      .strokeColor(COLOR_SECUNDARIO).lineWidth(0.5).stroke();

    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLOR_PRIMARIO)
      .text('Diferencia:', MARGEN + 12, y + 39, { width: 280 });
    doc.fontSize(11).font('Helvetica-Bold').fillColor(colorDif)
      .text(
        `${diferencia >= 0 ? '+' : ''}${this.formatPeso(diferencia)}`,
        MARGEN + 292, y + 39,
        { width: 199, align: 'right' },
      );

    doc.y = y + 70;
  }

  private dibujarFirmasCaja(doc: PDFKit.PDFDocument) {
    const y = doc.y + 20;

    if (y > 700) { doc.addPage(); doc.y = MARGEN; }

    const mitad = MARGEN + ANCHO_UTIL / 2;

    doc.moveTo(MARGEN + 20, y + 40).lineTo(mitad - 20, y + 40)
      .strokeColor(COLOR_LINEA).lineWidth(1).stroke();
    doc.moveTo(mitad + 20, y + 40).lineTo(MARGEN + ANCHO_UTIL - 20, y + 40)
      .strokeColor(COLOR_LINEA).lineWidth(1).stroke();

    doc.fontSize(9).fillColor(COLOR_SUBTEXTO).font('Helvetica')
      .text('Firma del Cajero', MARGEN + 20, y + 44, { width: mitad - MARGEN - 40, align: 'center' })
      .text('Firma del Supervisor', mitad + 20, y + 44, { width: MARGEN + ANCHO_UTIL - mitad - 40, align: 'center' });

    doc.y = y + 64;
  }

  private dibujarPieCaja(doc: PDFKit.PDFDocument, config: ConfiguracionSucursal | null) {
    const yPie = 780;
    doc.moveTo(MARGEN, yPie).lineTo(MARGEN + ANCHO_UTIL, yPie)
      .strokeColor(COLOR_LINEA).lineWidth(1).stroke();

    const generado = new Date().toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    doc.fontSize(8).fillColor(COLOR_SUBTEXTO)
      .text(
        `${config?.nombre_fantasia_ticket ?? 'ERP'}  |  Generado: ${generado}`,
        MARGEN, yPie + 6,
        { width: ANCHO_UTIL, align: 'center' },
      );
  }
}
