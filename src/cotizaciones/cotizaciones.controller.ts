import { Body, Controller, Get, Param, Patch, Post, Request } from '@nestjs/common';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';
import {
  CambiarEstadoCotizacionDto,
  ConvertirCotizacionDto,
  CreateCotizacionDto,
} from './dto/cotizacion.dto';
import { CotizacionesService } from './cotizaciones.service';

@Controller('cotizaciones')
export class CotizacionesController {
  constructor(private readonly cotizacionesService: CotizacionesService) {}

  @Post()
  @RequierePermiso('ventas.cotizacion')
  create(
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: CreateCotizacionDto,
  ) {
    return this.cotizacionesService.create(sucursalId, req.user.id, dto);
  }

  @Get()
  @RequierePermiso('ventas.cotizacion')
  findAll(@SucursalActiva() sucursalId: string) {
    return this.cotizacionesService.findAll(sucursalId);
  }

  @Get(':id')
  @RequierePermiso('ventas.cotizacion')
  findOne(@Param('id') id: string, @SucursalActiva() sucursalId: string) {
    return this.cotizacionesService.findOne(id, sucursalId);
  }

  @Patch(':id/enviar')
  @RequierePermiso('ventas.cotizacion')
  enviar(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Body() dto: CambiarEstadoCotizacionDto,
  ) {
    return this.cotizacionesService.enviar(id, sucursalId, dto);
  }

  @Patch(':id/aceptar')
  @RequierePermiso('ventas.cotizacion')
  aceptar(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Body() dto: CambiarEstadoCotizacionDto,
  ) {
    return this.cotizacionesService.aceptar(id, sucursalId, dto);
  }

  @Patch(':id/rechazar')
  @RequierePermiso('ventas.cotizacion')
  rechazar(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Body() dto: CambiarEstadoCotizacionDto,
  ) {
    return this.cotizacionesService.rechazar(id, sucursalId, dto);
  }

  @Patch(':id/convertir-venta')
  @RequierePermiso('ventas.cotizacion.convertir')
  convertirVenta(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: ConvertirCotizacionDto,
  ) {
    return this.cotizacionesService.convertirEnVenta(
      id,
      sucursalId,
      req.user.id,
      dto,
    );
  }

  @Post('vencer-expiradas')
  @RequierePermiso('ventas.cotizacion')
  vencerExpiradas(@SucursalActiva() sucursalId: string) {
    return this.cotizacionesService.vencerExpiradas(sucursalId);
  }
}
