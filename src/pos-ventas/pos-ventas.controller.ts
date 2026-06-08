import { Body, Controller, Get, Param, Patch, Post, Query, Request } from '@nestjs/common';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';
import {
  CancelarVentaPosDto,
  CobrarVentaPosDto,
  CrearVentaPosDto,
  DevolverVentaPosDto,
  EmitirDesdeVentaDto,
  VentaCuentaCorrientePosDto,
  VentaCompletaPosDto,
} from './dto/pos-venta.dto';
import { PosVentasService } from './pos-ventas.service';

@Controller('pos-ventas')
export class PosVentasController {
  constructor(private readonly posVentasService: PosVentasService) {}

  private puedeVerTodasLasVentas(req: any): boolean {
    return (
      req.user?.permisos?.includes('reportes.ver') ||
      req.user?.permisos?.includes('reportes.ventas') ||
      req.user?.permisos?.includes('config.pos')
    );
  }

  @Post()
  @RequierePermiso('ventas.crear')
  crear(
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: CrearVentaPosDto,
  ) {
    return this.posVentasService.crearVenta(sucursalId, req.user.id, dto);
  }

  @Post('completa')
  @RequierePermiso('ventas.crear', 'caja.cobrar')
  ventaCompleta(
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: VentaCompletaPosDto,
  ) {
    return this.posVentasService.ventaCompleta(sucursalId, req.user.id, dto);
  }

  @Post('cuenta-corriente')
  @RequierePermiso('ventas.crear')
  ventaCuentaCorriente(
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: VentaCuentaCorrientePosDto,
  ) {
    return this.posVentasService.ventaCuentaCorriente(sucursalId, req.user.id, dto);
  }

  @Get()
  @RequierePermiso('ventas.ver')
  findAll(
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('empleado_id') empleadoId?: string,
  ) {
    const puedeVerTodas = this.puedeVerTodasLasVentas(req);
    if (page || limit || desde || hasta || empleadoId) {
      return this.posVentasService.findAllPaginado(sucursalId, {
        page: Number(page ?? 1),
        limit: Number(limit ?? 50),
        desde,
        hasta,
        empleadoId: puedeVerTodas ? empleadoId : req.user.id,
      });
    }

    return this.posVentasService.findAll(sucursalId, puedeVerTodas ? undefined : req.user.id);
  }

  @Get('general')
  @RequierePermiso('ventas.ver')
  findAllGeneral(@SucursalActiva() sucursalId: string, @Request() req) {
    return this.posVentasService.findAllGeneral(
      sucursalId,
      this.puedeVerTodasLasVentas(req) ? undefined : req.user.id,
    );
  }

  @Get('pendientes-cobro')
  @RequierePermiso('caja.cobrar')
  pendientesCobro(@SucursalActiva() sucursalId: string) {
    return this.posVentasService.pendientesCobro(sucursalId);
  }

  @Get('caja/:cajaId')
  @RequierePermiso('caja.ver')
  ventasPorCaja(
    @Param('cajaId') cajaId: string,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.posVentasService.ventasPorCaja(cajaId, sucursalId);
  }

  @Get(':id')
  @RequierePermiso('ventas.ver')
  findOne(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
  ) {
    return this.posVentasService.findOne(
      id,
      sucursalId,
      this.puedeVerTodasLasVentas(req) ? undefined : req.user.id,
    );
  }

  @Post(':id/cobrar')
  @RequierePermiso('caja.cobrar')
  cobrar(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: CobrarVentaPosDto,
  ) {
    return this.posVentasService.cobrarVenta(id, sucursalId, req.user.id, dto);
  }

  @Post(':id/emitir-comprobante')
  @RequierePermiso('caja.cobrar')
  emitirComprobante(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: EmitirDesdeVentaDto,
  ) {
    return this.posVentasService.emitirComprobante(id, sucursalId, req.user.id, dto);
  }

  @Patch(':id/cancelar')
  @RequierePermiso('ventas.cancelar')
  cancelar(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: CancelarVentaPosDto,
  ) {
    return this.posVentasService.cancelarVenta(id, sucursalId, req.user.id, dto);
  }

  @Post(':id/devolver')
  @RequierePermiso('ventas.cancelar.pagada')
  devolver(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: DevolverVentaPosDto,
  ) {
    return this.posVentasService.devolverVenta(id, sucursalId, req.user.id, dto);
  }
}
