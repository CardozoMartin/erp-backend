import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

// Estilos reutilizables
const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1A237E' },
};
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
const SUBTOTAL_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE8EAF6' },
};
const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top:    { style: 'thin', color: { argb: 'FFB0B0B0' } },
  left:   { style: 'thin', color: { argb: 'FFB0B0B0' } },
  bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  right:  { style: 'thin', color: { argb: 'FFB0B0B0' } },
};

export type ReporteVentasPorDia = { fecha: string; cantidad: number; total: number };
export type ReporteMediosPago  = { tipo: string; medio_pago: string; cantidad: number; monto: number; recargos: number; total: number };
export type ReporteProductos   = { producto: string; cantidad: number; total: number; costo: number; margen: number; margen_porcentaje: number };
export type ReporteEmpleados   = { empleado: string; cantidad: number; total: number };
export type ReporteCajas       = { empleado: string; fecha_apertura: Date | string; fecha_cierre: Date | string | null; monto_inicial: number; total_vendido: number; ventas: number; diferencia: number | null };
export type ReporteStock       = { producto: string; tipo: string; origen: string; movimientos: number; cantidad: number };
export type ReporteCobrosPendientes = {
  total_clientes: number;
  total_deuda: number;
  clientes: {
    cliente_id: string;
    cliente: string;
    email: string | null;
    telefono: string | null;
    saldo: number;
    limite_credito: number;
    limite_disponible: number | null;
    cantidad_cargos: number;
    total_cargos: number;
    total_pagado: number;
    cargo_mas_antiguo: Date | string | null;
    ultimo_pago: Date | string | null;
    proximo_vencimiento: Date | string | null;
  }[];
};

export type ReporteNotaCredito = {
  numero: string;
  fecha: Date | string;
  estado: string;
  venta_origen_numero: string | null;
  empleado: string;
  observaciones: string | null;
  total: number;
  items: { descripcion: string; cantidad: number; precio_unitario: number; subtotal: number }[];
};

@Injectable()
export class ExcelService {

  // 1.- Ventas por día
  async ventasPorDia(datos: ReporteVentasPorDia[], periodo: string): Promise<Buffer> {
    const wb = this.crearLibro(`Ventas por día — ${periodo}`);
    const ws = wb.addWorksheet('Ventas por día');

    this.agregarTitulo(ws, 'Ventas por Día', periodo, 3);
    this.agregarEncabezados(ws, ['Fecha', 'Cant. ventas', 'Total']);
    ws.getColumn(1).width = 18;
    ws.getColumn(2).width = 16;
    ws.getColumn(3).width = 20;
    ws.getColumn(3).numFmt = '"$ "#,##0.00';

    let totalVentas = 0, totalMonto = 0;
    for (const fila of datos) {
      const row = ws.addRow([this.formatFecha(fila.fecha), fila.cantidad, fila.total]);
      row.getCell(3).numFmt = '"$ "#,##0.00';
      this.bordeFila(row, 3);
      totalVentas += fila.cantidad;
      totalMonto  += fila.total;
    }
    this.agregarTotalFinal(ws, ['TOTAL', totalVentas, totalMonto], 3, [3]);

    return this.toBuffer(wb);
  }

  // 2.- Medios de pago
  async mediosPago(datos: ReporteMediosPago[], periodo: string): Promise<Buffer> {
    const wb = this.crearLibro(`Medios de pago — ${periodo}`);
    const ws = wb.addWorksheet('Medios de pago');

    this.agregarTitulo(ws, 'Medios de Pago', periodo, 5);
    this.agregarEncabezados(ws, ['Medio de pago', 'Cant. cobros', 'Monto', 'Recargos', 'Total']);
    [1,2,3,4,5].forEach((c, i) => { ws.getColumn(c).width = [28, 14, 18, 14, 18][i]; });

    let totalMonto = 0, totalRec = 0, totalFinal = 0;
    for (const fila of datos) {
      const row = ws.addRow([fila.medio_pago, fila.cantidad, fila.monto, fila.recargos, fila.total]);
      [3,4,5].forEach(c => { row.getCell(c).numFmt = '"$ "#,##0.00'; });
      this.bordeFila(row, 5);
      totalMonto += fila.monto; totalRec += fila.recargos; totalFinal += fila.total;
    }
    this.agregarTotalFinal(ws, ['TOTAL', '', totalMonto, totalRec, totalFinal], 5, [3,4,5]);

    return this.toBuffer(wb);
  }

  // 3.- Ranking de productos
  async productos(datos: ReporteProductos[], periodo: string): Promise<Buffer> {
    const wb = this.crearLibro(`Productos — ${periodo}`);
    const ws = wb.addWorksheet('Productos');

    this.agregarTitulo(ws, 'Ranking de Productos Vendidos', periodo, 6);
    this.agregarEncabezados(ws, ['Producto', 'Cant. vendida', 'Total venta', 'Costo estimado', 'Margen $', 'Margen %']);
    [1,2,3,4,5,6].forEach((c, i) => { ws.getColumn(c).width = [36, 14, 18, 18, 16, 12][i]; });

    let totCant = 0, totVenta = 0, totCosto = 0, totMargen = 0;
    for (const fila of datos) {
      const row = ws.addRow([fila.producto, fila.cantidad, fila.total, fila.costo, fila.margen, fila.margen_porcentaje / 100]);
      [3,4,5].forEach(c => { row.getCell(c).numFmt = '"$ "#,##0.00'; });
      row.getCell(6).numFmt = '0.00%';
      this.bordeFila(row, 6);
      totCant += fila.cantidad; totVenta += fila.total; totCosto += fila.costo; totMargen += fila.margen;
    }
    const margenPct = totVenta > 0 ? (totMargen / totVenta) : 0;
    this.agregarTotalFinal(ws, ['TOTAL', totCant, totVenta, totCosto, totMargen, margenPct], 6, [3,4,5,6]);
    const totalRow = ws.lastRow!;
    totalRow.getCell(6).numFmt = '0.00%';

    return this.toBuffer(wb);
  }

  // 4.- Ventas por empleado
  async empleados(datos: ReporteEmpleados[], periodo: string): Promise<Buffer> {
    const wb = this.crearLibro(`Empleados — ${periodo}`);
    const ws = wb.addWorksheet('Empleados');

    this.agregarTitulo(ws, 'Ventas por Empleado', periodo, 3);
    this.agregarEncabezados(ws, ['Empleado', 'Cant. ventas', 'Total']);
    ws.getColumn(1).width = 32; ws.getColumn(2).width = 14; ws.getColumn(3).width = 20;

    let totCant = 0, totTotal = 0;
    for (const fila of datos) {
      const row = ws.addRow([fila.empleado, fila.cantidad, fila.total]);
      row.getCell(3).numFmt = '"$ "#,##0.00';
      this.bordeFila(row, 3);
      totCant += fila.cantidad; totTotal += fila.total;
    }
    this.agregarTotalFinal(ws, ['TOTAL', totCant, totTotal], 3, [3]);

    return this.toBuffer(wb);
  }

  // 5.- Cajas
  async cajas(datos: ReporteCajas[], periodo: string): Promise<Buffer> {
    const wb = this.crearLibro(`Cajas — ${periodo}`);
    const ws = wb.addWorksheet('Cajas');

    this.agregarTitulo(ws, 'Resumen de Cajas', periodo, 7);
    this.agregarEncabezados(ws, ['Empleado', 'Apertura', 'Cierre', 'Monto inicial', 'Ventas', 'Total vendido', 'Diferencia']);
    [1,2,3,4,5,6,7].forEach((c, i) => { ws.getColumn(c).width = [28, 20, 20, 16, 10, 18, 14][i]; });

    for (const fila of datos) {
      const row = ws.addRow([
        fila.empleado,
        fila.fecha_apertura ? new Date(fila.fecha_apertura) : '',
        fila.fecha_cierre   ? new Date(fila.fecha_cierre)   : 'Abierta',
        fila.monto_inicial,
        fila.ventas,
        fila.total_vendido,
        fila.diferencia ?? '',
      ]);
      row.getCell(2).numFmt = 'dd/mm/yyyy hh:mm';
      row.getCell(3).numFmt = 'dd/mm/yyyy hh:mm';
      [4,6].forEach(c => { row.getCell(c).numFmt = '"$ "#,##0.00'; });
      if (fila.diferencia !== null) {
        row.getCell(7).numFmt = '"$ "#,##0.00';
        row.getCell(7).font = { color: { argb: (fila.diferencia ?? 0) < 0 ? 'FFCC0000' : 'FF2E7D32' } };
      }
      this.bordeFila(row, 7);
    }

    return this.toBuffer(wb);
  }

  // 6.- Cobros pendientes / cuentas corrientes con saldo deudor
  async cobrosPendientes(datos: ReporteCobrosPendientes): Promise<Buffer> {
    const wb = this.crearLibro('Cobros Pendientes — Cuenta Corriente');
    const ws = wb.addWorksheet('Cobros Pendientes');

    // Fila resumen en el encabezado
    ws.mergeCells(1, 1, 1, 9);
    const tituloCell = ws.getCell('A1');
    tituloCell.value = 'Cobros Pendientes — Cuenta Corriente';
    tituloCell.font = { bold: true, size: 14, color: { argb: 'FF1A237E' } };
    tituloCell.alignment = { horizontal: 'center' };

    ws.mergeCells(2, 1, 2, 9);
    const resumenCell = ws.getCell('A2');
    resumenCell.value = `Total clientes con deuda: ${datos.total_clientes}   |   Total deuda: $ ${datos.total_deuda.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    resumenCell.font = { bold: true, size: 11, color: { argb: 'FFCC0000' } };
    resumenCell.alignment = { horizontal: 'center' };

    ws.addRow([]);

    this.agregarEncabezados(ws, [
      'Cliente',
      'Email',
      'Teléfono',
      'Saldo deudor',
      'Límite crédito',
      'Límite disponible',
      'Cargo más antiguo',
      'Último pago',
      'Próx. vencimiento',
    ]);
    [1,2,3,4,5,6,7,8,9].forEach((c, i) => {
      ws.getColumn(c).width = [32, 28, 16, 16, 16, 18, 20, 20, 20][i];
    });

    for (const fila of datos.clientes) {
      const row = ws.addRow([
        fila.cliente,
        fila.email ?? '—',
        fila.telefono ?? '—',
        fila.saldo,
        fila.limite_credito,
        fila.limite_disponible ?? '—',
        fila.cargo_mas_antiguo ? new Date(fila.cargo_mas_antiguo) : '—',
        fila.ultimo_pago ? new Date(fila.ultimo_pago) : 'Sin pagos',
        fila.proximo_vencimiento ? new Date(fila.proximo_vencimiento) : '—',
      ]);

      [4, 5].forEach(c => { row.getCell(c).numFmt = '"$ "#,##0.00'; });
      if (fila.limite_disponible !== null) row.getCell(6).numFmt = '"$ "#,##0.00';
      [7, 8, 9].forEach(c => {
        const cell = row.getCell(c);
        if (cell.value instanceof Date) cell.numFmt = 'dd/mm/yyyy';
      });

      // Colorear la fila si el saldo supera el límite
      if (fila.limite_credito > 0 && fila.saldo > fila.limite_credito) {
        row.getCell(4).font = { color: { argb: 'FFCC0000' }, bold: true };
      }

      this.bordeFila(row, 9);
    }

    this.agregarTotalFinal(
      ws,
      ['TOTAL', '', '', datos.total_deuda, '', '', '', '', ''],
      9,
      [4],
    );

    return this.toBuffer(wb);
  }

  // 7.- Notas de crédito con detalle de items
  async notasCredito(datos: ReporteNotaCredito[], periodo: string): Promise<Buffer> {
    const wb = this.crearLibro(`Notas de Crédito — ${periodo}`);
    const ws = wb.addWorksheet('Notas de Crédito');

    this.agregarTitulo(ws, 'Notas de Crédito', periodo, 6);
    this.agregarEncabezados(ws, ['N° Nota', 'Fecha', 'Venta origen', 'Empleado', 'Estado', 'Total']);
    [1,2,3,4,5,6].forEach((c, i) => { ws.getColumn(c).width = [18, 18, 18, 28, 16, 16][i]; });

    const ITEM_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
    const ITEM_HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };

    let totalGeneral = 0;
    for (const nota of datos) {
      // Fila cabecera de la nota
      const rowNota = ws.addRow([
        nota.numero,
        nota.fecha ? new Date(nota.fecha) : '',
        nota.venta_origen_numero ?? '—',
        nota.empleado,
        nota.estado,
        nota.total,
      ]);
      rowNota.getCell(2).numFmt = 'dd/mm/yyyy hh:mm';
      rowNota.getCell(6).numFmt = '"$ "#,##0.00';
      rowNota.font = { bold: true };
      this.bordeFila(rowNota, 6);
      totalGeneral += nota.total;

      if (nota.observaciones) {
        const rowObs = ws.addRow(['', `Obs: ${nota.observaciones}`, '', '', '', '']);
        rowObs.getCell(2).font = { italic: true, color: { argb: 'FF757575' } };
      }

      // Sub-encabezado de items
      const rowItemHeader = ws.addRow(['', 'Descripción', 'Cant.', 'Precio unit.', 'Subtotal', '']);
      [2,3,4,5].forEach(c => {
        rowItemHeader.getCell(c).fill = ITEM_HEADER_FILL;
        rowItemHeader.getCell(c).font = { bold: true, size: 10 };
        rowItemHeader.getCell(c).border = BORDER_THIN;
      });

      // Items de la nota
      for (const item of nota.items) {
        const rowItem = ws.addRow(['', item.descripcion, item.cantidad, item.precio_unitario, item.subtotal, '']);
        [4,5].forEach(c => { rowItem.getCell(c).numFmt = '"$ "#,##0.00'; });
        [2,3,4,5].forEach(c => {
          rowItem.getCell(c).fill = ITEM_FILL;
          rowItem.getCell(c).border = BORDER_THIN;
        });
      }

      ws.addRow([]); // espacio entre notas
    }

    this.agregarTotalFinal(ws, ['TOTAL NOTAS DE CRÉDITO', '', '', '', '', totalGeneral], 6, [6]);

    return this.toBuffer(wb);
  }

  // 7.- Movimientos de stock
  async stock(datos: ReporteStock[], periodo: string): Promise<Buffer> {
    const wb = this.crearLibro(`Stock — ${periodo}`);
    const ws = wb.addWorksheet('Movimientos de stock');

    this.agregarTitulo(ws, 'Movimientos de Stock', periodo, 5);
    this.agregarEncabezados(ws, ['Producto', 'Tipo', 'Origen', 'Movimientos', 'Cantidad']);
    [1,2,3,4,5].forEach((c, i) => { ws.getColumn(c).width = [36, 14, 16, 14, 14][i]; });

    for (const fila of datos) {
      const row = ws.addRow([fila.producto, fila.tipo, fila.origen, fila.movimientos, fila.cantidad]);
      this.bordeFila(row, 5);
    }

    return this.toBuffer(wb);
  }

  // 8.- Reporte contable completo (multi-hoja)
  async reporteContable(datos: {
    periodo: string;
    resumen: {
      ventas: { cantidad: number; subtotal: number; descuentos: number; total: number };
      cobros: { total: number };
      rentabilidad: { costo_estimado: number; ganancia_estimada: number; margen_porcentaje: number };
      notas_credito: { cantidad: number; total: number };
    };
    ventasPorDia: ReporteVentasPorDia[];
    mediosPago: ReporteMediosPago[];
    productos: ReporteProductos[];
    empleados: ReporteEmpleados[];
    deudores: ReporteCobrosPendientes;
  }): Promise<Buffer> {
    const wb = this.crearLibro(`Reporte Contable — ${datos.periodo}`);

    // ── Hoja 1: Resumen ejecutivo ──────────────────────────────────────────────
    const wsRes = wb.addWorksheet('Resumen');
    wsRes.mergeCells('A1:C1');
    const t = wsRes.getCell('A1');
    t.value = 'Reporte Contable — Resumen Ejecutivo';
    t.font = { bold: true, size: 15, color: { argb: 'FF1A237E' } };
    t.alignment = { horizontal: 'center' };
    wsRes.mergeCells('A2:C2');
    const p = wsRes.getCell('A2');
    p.value = `Período: ${datos.periodo}`;
    p.font = { size: 10, color: { argb: 'FF616161' } };
    p.alignment = { horizontal: 'center' };
    wsRes.addRow([]);

    const kpis: [string, number | string][] = [
      ['Cantidad de ventas',       datos.resumen.ventas.cantidad],
      ['Total vendido',            datos.resumen.ventas.total],
      ['Descuentos otorgados',     datos.resumen.ventas.descuentos],
      ['Notas de crédito emitidas', datos.resumen.notas_credito.cantidad],
      ['Total notas de crédito',   datos.resumen.notas_credito.total],
      ['Total neto (vendido - NC)', datos.resumen.ventas.total - datos.resumen.notas_credito.total],
      ['Total cobrado',            datos.resumen.cobros.total],
      ['Costo estimado',           datos.resumen.rentabilidad.costo_estimado],
      ['Ganancia estimada',        datos.resumen.rentabilidad.ganancia_estimada],
      ['Margen %',                 datos.resumen.rentabilidad.margen_porcentaje / 100],
    ];
    const monedaCols = [1, 2, 4, 5, 6, 7, 8];
    kpis.forEach(([label, value], idx) => {
      const row = wsRes.addRow([label, value]);
      row.getCell(1).font = { bold: true };
      row.getCell(1).border = BORDER_THIN;
      row.getCell(2).border = BORDER_THIN;
      if (monedaCols.includes(idx)) {
        row.getCell(2).numFmt = '"$ "#,##0.00';
      }
      if (idx === 9) {
        row.getCell(2).numFmt = '0.00%';
      }
    });
    wsRes.getColumn(1).width = 36;
    wsRes.getColumn(2).width = 22;

    // ── Hoja 2: Ventas por día ─────────────────────────────────────────────────
    const wsDia = wb.addWorksheet('Ventas por día');
    this.agregarTitulo(wsDia, 'Ventas por Día', datos.periodo, 4);
    this.agregarEncabezados(wsDia, ['Fecha', 'Cant. ventas', 'Total', 'Ticket promedio']);
    [1,2,3,4].forEach((c, i) => { wsDia.getColumn(c).width = [18,14,20,20][i]; });
    let totDiaCant = 0, totDiaTotal = 0;
    for (const fila of datos.ventasPorDia) {
      const prom = fila.cantidad > 0 ? fila.total / fila.cantidad : 0;
      const row = wsDia.addRow([this.formatFecha(fila.fecha), fila.cantidad, fila.total, prom]);
      [3,4].forEach(c => { row.getCell(c).numFmt = '"$ "#,##0.00'; });
      this.bordeFila(row, 4);
      totDiaCant += fila.cantidad; totDiaTotal += fila.total;
    }
    this.agregarTotalFinal(wsDia, ['TOTAL', totDiaCant, totDiaTotal, totDiaCant > 0 ? totDiaTotal / totDiaCant : 0], 4, [3,4]);

    // ── Hoja 3: Medios de pago ─────────────────────────────────────────────────
    const wsMedios = wb.addWorksheet('Medios de pago');
    this.agregarTitulo(wsMedios, 'Cobros por Medio de Pago', datos.periodo, 5);
    this.agregarEncabezados(wsMedios, ['Medio de pago', 'Cant. cobros', 'Monto', 'Recargos', 'Total cobrado']);
    [1,2,3,4,5].forEach((c, i) => { wsMedios.getColumn(c).width = [28,14,18,14,18][i]; });
    let totMedMonto = 0, totMedRec = 0, totMedTotal = 0;
    for (const fila of datos.mediosPago) {
      const row = wsMedios.addRow([fila.medio_pago, fila.cantidad, fila.monto, fila.recargos, fila.total]);
      [3,4,5].forEach(c => { row.getCell(c).numFmt = '"$ "#,##0.00'; });
      this.bordeFila(row, 5);
      totMedMonto += fila.monto; totMedRec += fila.recargos; totMedTotal += fila.total;
    }
    this.agregarTotalFinal(wsMedios, ['TOTAL', '', totMedMonto, totMedRec, totMedTotal], 5, [3,4,5]);

    // ── Hoja 4: Rentabilidad por producto ─────────────────────────────────────
    const wsProd = wb.addWorksheet('Productos');
    this.agregarTitulo(wsProd, 'Rentabilidad por Producto', datos.periodo, 6);
    this.agregarEncabezados(wsProd, ['Producto', 'Cant.', 'Total venta', 'Costo est.', 'Ganancia', 'Margen %']);
    [1,2,3,4,5,6].forEach((c, i) => { wsProd.getColumn(c).width = [36,10,18,18,18,12][i]; });
    let totProdCant = 0, totProdVenta = 0, totProdCosto = 0, totProdMargen = 0;
    for (const fila of datos.productos) {
      const row = wsProd.addRow([fila.producto, fila.cantidad, fila.total, fila.costo, fila.margen, fila.margen_porcentaje / 100]);
      [3,4,5].forEach(c => { row.getCell(c).numFmt = '"$ "#,##0.00'; });
      row.getCell(6).numFmt = '0.00%';
      if (fila.margen_porcentaje < 10) row.getCell(6).font = { color: { argb: 'FFCC0000' } };
      else if (fila.margen_porcentaje < 30) row.getCell(6).font = { color: { argb: 'FFB45309' } };
      else row.getCell(6).font = { color: { argb: 'FF2E7D32' } };
      this.bordeFila(row, 6);
      totProdCant += fila.cantidad; totProdVenta += fila.total; totProdCosto += fila.costo; totProdMargen += fila.margen;
    }
    const margenFinal = totProdVenta > 0 ? totProdMargen / totProdVenta : 0;
    this.agregarTotalFinal(wsProd, ['TOTAL', totProdCant, totProdVenta, totProdCosto, totProdMargen, margenFinal], 6, [3,4,5,6]);
    wsProd.lastRow!.getCell(6).numFmt = '0.00%';

    // ── Hoja 5: Ventas por vendedor ────────────────────────────────────────────
    const wsEmp = wb.addWorksheet('Vendedores');
    this.agregarTitulo(wsEmp, 'Ventas por Vendedor', datos.periodo, 3);
    this.agregarEncabezados(wsEmp, ['Vendedor', 'Cant. ventas', 'Total vendido']);
    [1,2,3].forEach((c, i) => { wsEmp.getColumn(c).width = [32,14,20][i]; });
    let totEmpCant = 0, totEmpTotal = 0;
    for (const fila of datos.empleados) {
      const row = wsEmp.addRow([fila.empleado, fila.cantidad, fila.total]);
      row.getCell(3).numFmt = '"$ "#,##0.00';
      this.bordeFila(row, 3);
      totEmpCant += fila.cantidad; totEmpTotal += fila.total;
    }
    this.agregarTotalFinal(wsEmp, ['TOTAL', totEmpCant, totEmpTotal], 3, [3]);

    // ── Hoja 6: Deudores ──────────────────────────────────────────────────────
    const wsDeuda = wb.addWorksheet('Deudores');
    wsDeuda.mergeCells('A1:C1');
    const tdDeuda = wsDeuda.getCell('A1');
    tdDeuda.value = 'Cuentas Corrientes con Saldo Deudor';
    tdDeuda.font = { bold: true, size: 14, color: { argb: 'FF1A237E' } };
    tdDeuda.alignment = { horizontal: 'center' };
    wsDeuda.mergeCells('A2:C2');
    const resDeuda = wsDeuda.getCell('A2');
    resDeuda.value = `Total deuda: $ ${datos.deudores.total_deuda.toLocaleString('es-AR', { minimumFractionDigits: 2 })}   |   Clientes: ${datos.deudores.total_clientes}`;
    resDeuda.font = { bold: true, size: 11, color: { argb: 'FFCC0000' } };
    resDeuda.alignment = { horizontal: 'center' };
    wsDeuda.addRow([]);
    this.agregarEncabezados(wsDeuda, ['Cliente', 'Saldo deudor', 'Límite crédito', 'Último pago', 'Próx. vencimiento']);
    [1,2,3,4,5].forEach((c, i) => { wsDeuda.getColumn(c).width = [34,18,18,20,20][i]; });
    for (const fila of datos.deudores.clientes) {
      const row = wsDeuda.addRow([
        fila.cliente,
        fila.saldo,
        fila.limite_credito,
        fila.ultimo_pago ? new Date(fila.ultimo_pago) : 'Sin pagos',
        fila.proximo_vencimiento ? new Date(fila.proximo_vencimiento) : '—',
      ]);
      [2,3].forEach(c => { row.getCell(c).numFmt = '"$ "#,##0.00'; });
      [4,5].forEach(c => { if (row.getCell(c).value instanceof Date) row.getCell(c).numFmt = 'dd/mm/yyyy'; });
      row.getCell(2).font = { bold: true, color: { argb: 'FFCC0000' } };
      this.bordeFila(row, 5);
    }
    this.agregarTotalFinal(wsDeuda, ['TOTAL DEUDA', datos.deudores.total_deuda, '', '', ''], 5, [2]);

    return this.toBuffer(wb);
  }

  // --- Helpers de construcción ---

  private crearLibro(titulo: string): ExcelJS.Workbook {
    const wb = new ExcelJS.Workbook();
    wb.creator   = 'ERP Sistema de Gestión';
    wb.created   = new Date();
    wb.title     = titulo;
    return wb;
  }

  // 2.- Fila de título + período fusionada
  private agregarTitulo(ws: ExcelJS.Worksheet, titulo: string, periodo: string, cols: number) {
    ws.mergeCells(1, 1, 1, cols);
    const titleCell = ws.getCell('A1');
    titleCell.value = titulo;
    titleCell.font  = { bold: true, size: 14, color: { argb: 'FF1A237E' } };
    titleCell.alignment = { horizontal: 'center' };

    ws.mergeCells(2, 1, 2, cols);
    const periodoCell = ws.getCell('A2');
    periodoCell.value = `Período: ${periodo}`;
    periodoCell.font  = { size: 10, color: { argb: 'FF616161' } };
    periodoCell.alignment = { horizontal: 'center' };

    ws.addRow([]);
  }

  // 3.- Fila de encabezados con estilo
  private agregarEncabezados(ws: ExcelJS.Worksheet, columnas: string[]) {
    const row = ws.addRow(columnas);
    row.eachCell((cell) => {
      cell.fill   = HEADER_FILL;
      cell.font   = HEADER_FONT;
      cell.border = BORDER_THIN;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    row.height = 22;
    ws.views = [{ state: 'frozen', ySplit: row.number }];
  }

  // 4.- Bordes a cada celda de una fila
  private bordeFila(row: ExcelJS.Row, cols: number) {
    for (let c = 1; c <= cols; c++) {
      row.getCell(c).border = BORDER_THIN;
    }
  }

  // 5.- Fila de total al pie con fondo coloreado
  private agregarTotalFinal(ws: ExcelJS.Worksheet, valores: (string | number)[], cols: number, numericCols: number[]) {
    const row = ws.addRow(valores);
    row.eachCell((cell, colNum) => {
      cell.fill   = SUBTOTAL_FILL;
      cell.font   = { bold: true };
      cell.border = BORDER_THIN;
      if (numericCols.includes(colNum)) {
        cell.numFmt = '"$ "#,##0.00';
      }
    });
  }

  private toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
    return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  private formatFecha(fecha: string | Date): string {
    const d = new Date(fecha);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
