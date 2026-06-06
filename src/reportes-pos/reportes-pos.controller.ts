import { Controller, Get, Query } from '@nestjs/common';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';
import { ReportePosQueryDto } from './dto/reporte-pos-query.dto';
import { ReportesPosService } from './reportes-pos.service';

@Controller('reportes-pos')
export class ReportesPosController {
  constructor(private readonly reportesPosService: ReportesPosService) {}

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

  @Get('stock')
  @RequierePermiso('reportes.ver')
  stock(
    @SucursalActiva() sucursalId: string,
    @Query() query: ReportePosQueryDto,
  ) {
    return this.reportesPosService.stock(sucursalId, query);
  }
}
