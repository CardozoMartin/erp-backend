import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';
import { ExcelService } from 'src/excel/excel.service';
import { ReportePosQueryDto } from './dto/reporte-pos-query.dto';
import { ReportesPosService } from './reportes-pos.service';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('reportes-pos')
export class ReportesPosController {
  constructor(
    private readonly reportesPosService: ReportesPosService,
    private readonly excelService: ExcelService,
  ) {}

  @Get('resumen')
  @RequierePermiso('reportes.ver')
  resumen(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
  ) {
    return this.reportesPosService.resumen(sucursalId, query);
  }

  @Get('ventas-por-dia')
  @RequierePermiso('reportes.ver')
  ventasPorDia(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
  ) {
    return this.reportesPosService.ventasPorDia(sucursalId, query);
  }

  @Get('medios-pago')
  @RequierePermiso('reportes.ver')
  mediosPago(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
  ) {
    return this.reportesPosService.mediosPago(sucursalId, query);
  }

  @Get('productos')
  @RequierePermiso('reportes.ver')
  productos(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
  ) {
    return this.reportesPosService.productos(sucursalId, query);
  }

  @Get('empleados')
  @RequierePermiso('reportes.ver')
  empleados(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
  ) {
    return this.reportesPosService.empleados(sucursalId, query);
  }

  @Get('cajas')
  @RequierePermiso('reportes.ver')
  cajas(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
  ) {
    return this.reportesPosService.cajas(sucursalId, query);
  }

  @Get('diferencias-caja')
  @RequierePermiso('reportes.caja')
  diferenciasCaja(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
  ) {
    return this.reportesPosService.diferenciasCaja(sucursalId, query);
  }

  @Get('cobros-pendientes')
  @RequierePermiso('reportes.ver')
  cobrosPendientes(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
  ) {
    return this.reportesPosService.cobrosPendientes(sucursalId, query);
  }

  @Get('notas-credito')
  @RequierePermiso('reportes.ver')
  notasCredito(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
  ) {
    return this.reportesPosService.notasCredito(sucursalId, query);
  }

  @Get('stock')
  @RequierePermiso('reportes.ver')
  stock(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
  ) {
    return this.reportesPosService.stock(sucursalId, query);
  }

  // --- Endpoints de exportación Excel ---

  @Get('exportar/ventas-por-dia')
  @RequierePermiso('reportes.exportar')
  async exportarVentasPorDia(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
    @Res() res: Response,
  ) {
    // 1.- Obtener datos del reporte
    const datos = await this.reportesPosService.ventasPorDia(sucursalId, query);
    const periodo = `${query.desde ?? ''} — ${query.hasta ?? ''}`;
    // 2.- Generar buffer Excel
    const buffer = await this.excelService.ventasPorDia(datos, periodo);
    // 3.- Enviar archivo
    res.set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="ventas-por-dia.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('exportar/medios-pago')
  @RequierePermiso('reportes.exportar')
  async exportarMediosPago(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
    @Res() res: Response,
  ) {
    // 1.- Obtener datos del reporte
    const datos = await this.reportesPosService.mediosPago(sucursalId, query);
    const periodo = `${query.desde ?? ''} — ${query.hasta ?? ''}`;
    // 2.- Generar buffer Excel
    const buffer = await this.excelService.mediosPago(datos, periodo);
    // 3.- Enviar archivo
    res.set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="medios-pago.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('exportar/productos')
  @RequierePermiso('reportes.exportar')
  async exportarProductos(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
    @Res() res: Response,
  ) {
    // 1.- Obtener datos del reporte
    const datos = await this.reportesPosService.productos(sucursalId, query);
    const periodo = `${query.desde ?? ''} — ${query.hasta ?? ''}`;
    // 2.- Generar buffer Excel
    const buffer = await this.excelService.productos(datos, periodo);
    // 3.- Enviar archivo
    res.set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="productos.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('exportar/empleados')
  @RequierePermiso('reportes.exportar')
  async exportarEmpleados(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
    @Res() res: Response,
  ) {
    // 1.- Obtener datos del reporte
    const datos = await this.reportesPosService.empleados(sucursalId, query);
    const periodo = `${query.desde ?? ''} — ${query.hasta ?? ''}`;
    // 2.- Generar buffer Excel
    const buffer = await this.excelService.empleados(datos, periodo);
    // 3.- Enviar archivo
    res.set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="empleados.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('exportar/cajas')
  @RequierePermiso('reportes.exportar')
  async exportarCajas(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
    @Res() res: Response,
  ) {
    // 1.- Obtener datos del reporte (sin límite de paginación para el export)
    const { data: datos } = await this.reportesPosService.cajas(sucursalId, { ...query, limit: 1000, page: 1 });
    const periodo = `${query.desde ?? ''} — ${query.hasta ?? ''}`;
    // 2.- Generar buffer Excel
    const buffer = await this.excelService.cajas(datos, periodo);
    // 3.- Enviar archivo
    res.set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="cajas.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('exportar/cobros-pendientes')
  @RequierePermiso('reportes.exportar')
  async exportarCobrosPendientes(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
    @Res() res: Response,
  ) {
    const datos = await this.reportesPosService.cobrosPendientes(sucursalId, query);
    const buffer = await this.excelService.cobrosPendientes(datos);
    res.set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="cobros-pendientes.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('exportar/notas-credito')
  @RequierePermiso('reportes.exportar')
  async exportarNotasCredito(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
    @Res() res: Response,
  ) {
    const datos = await this.reportesPosService.notasCredito(sucursalId, query);
    const periodo = `${query.desde ?? ''} — ${query.hasta ?? ''}`;
    const buffer = await this.excelService.notasCredito(datos, periodo);
    res.set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="notas-credito.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('exportar/reporte-contable')
  @RequierePermiso('reportes.ver')
  async exportarReporteContable(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
    @Res() res: Response,
  ) {
    const periodo = `${query.desde ?? ''} — ${query.hasta ?? ''}`;
    const [resumen, ventasPorDia, mediosPago, productos, empleados, deudores] = await Promise.all([
      this.reportesPosService.resumen(sucursalId, query),
      this.reportesPosService.ventasPorDia(sucursalId, query),
      this.reportesPosService.mediosPago(sucursalId, query),
      this.reportesPosService.productos(sucursalId, query),
      this.reportesPosService.empleados(sucursalId, query),
      this.reportesPosService.cobrosPendientes(sucursalId, query),
    ]);
    const buffer = await this.excelService.reporteContable({
      periodo,
      resumen,
      ventasPorDia,
      mediosPago,
      productos,
      empleados,
      deudores,
    });
    res.set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="reporte-contable-${query.desde ?? 'periodo'}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('exportar/stock')
  @RequierePermiso('reportes.exportar')
  async exportarStock(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
    @Res() res: Response,
  ) {
    // 1.- Obtener datos del reporte
    const datos = await this.reportesPosService.stock(sucursalId, query);
    const periodo = `${query.desde ?? ''} — ${query.hasta ?? ''}`;
    // 2.- Generar buffer Excel
    const buffer = await this.excelService.stock(datos, periodo);
    // 3.- Enviar archivo
    res.set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="stock.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
