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

  // 6.- Movimientos de stock
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
