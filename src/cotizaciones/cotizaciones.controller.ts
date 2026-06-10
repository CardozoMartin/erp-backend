import { Body, Controller, Get, Param, Patch, Post, Request } from '@nestjs/common';
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
  create(
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: CreateCotizacionDto,
  ) {
    return this.cotizacionesService.create(sucursalId, req.user.id, dto);
  }

  @Get()
  findAll(@SucursalActiva() sucursalId: string) {
    return this.cotizacionesService.findAll(sucursalId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @SucursalActiva() sucursalId: string) {
    return this.cotizacionesService.findOne(id, sucursalId);
  }

  @Patch(':id/enviar')
  enviar(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Body() dto: CambiarEstadoCotizacionDto,
  ) {
    return this.cotizacionesService.enviar(id, sucursalId, dto);
  }

  @Patch(':id/aceptar')
  aceptar(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Body() dto: CambiarEstadoCotizacionDto,
  ) {
    return this.cotizacionesService.aceptar(id, sucursalId, dto);
  }

  @Patch(':id/rechazar')
  rechazar(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Body() dto: CambiarEstadoCotizacionDto,
  ) {
    return this.cotizacionesService.rechazar(id, sucursalId, dto);
  }

  @Patch(':id/convertir-venta')
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
  vencerExpiradas(@SucursalActiva() sucursalId: string) {
    return this.cotizacionesService.vencerExpiradas(sucursalId);
  }
}
