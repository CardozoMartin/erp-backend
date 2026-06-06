import { Body, Controller, Get, Param, Patch, Post, Request } from '@nestjs/common';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';
import {
  AnularDespachoDto,
  CrearDespachoDto,
  EntregarDespachoDto,
} from './dto/create-despacho.dto';
import { DespachosService } from './despachos.service';

@Controller('despachos')
export class DespachosController {
  constructor(private readonly despachosService: DespachosService) {}

  @Post()
  @RequierePermiso('deposito.despachar')
  crear(
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: CrearDespachoDto,
  ) {
    return this.despachosService.crearDesdeComprobante(
      sucursalId,
      req.user.id,
      dto,
    );
  }

  @Get()
  @RequierePermiso('deposito.ver')
  findAll(@SucursalActiva() sucursalId: string) {
    return this.despachosService.findAll(sucursalId);
  }

  @Get(':id')
  @RequierePermiso('deposito.ver')
  findOne(@Param('id') id: string, @SucursalActiva() sucursalId: string) {
    return this.despachosService.findOne(id, sucursalId);
  }

  @Patch(':id/entregar')
  @RequierePermiso('deposito.despachar')
  entregar(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: EntregarDespachoDto,
  ) {
    return this.despachosService.entregar(id, sucursalId, req.user.id, dto);
  }

  @Patch(':id/anular')
  @RequierePermiso('deposito.despachar')
  anular(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: AnularDespachoDto,
  ) {
    return this.despachosService.anular(id, sucursalId, req.user.id, dto);
  }
}
