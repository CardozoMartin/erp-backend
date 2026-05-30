// ventas/ventas.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
} from '@nestjs/common';
import { VentasService } from './ventas-modulo.service';
import { CobrarVentaDto, CrearVentaDto } from './dto/create-ventas-modulo.dto';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';

@Controller('ventas')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Post()
  @RequierePermiso('ventas.crear')
  crear(
    @Request() req,
    @SucursalActiva() sucursalId: string,
    @Body() dto: CrearVentaDto,
  ) {
    return this.ventasService.crear({
      ...dto,
      sucursal_id: sucursalId,
      empleado_id: req.user.id,
    });
  }

  @Get('sucursal/:sucursalId')
  @RequierePermiso('ventas.ver')
  findBySucursal(
    @SucursalActiva() sucursalActivaId: string,
    @Param('sucursalId') sucursalId: string,
  ) {
    return this.ventasService.findBySucursal(sucursalId, sucursalActivaId);
  }

  @Get(':id')
  @RequierePermiso('ventas.ver')
  findOne(@Param('id') id: string, @SucursalActiva() sucursalId: string) {
    return this.ventasService.findOne(id, sucursalId);
  }

  @Patch(':id/cobrar')
  @RequierePermiso('caja.cobrar')
  cobrar(
    @Param('id') id: string,
    @Request() req,
    @SucursalActiva() sucursalId: string,
    @Body() dto: CobrarVentaDto,
  ) {
    return this.ventasService.cobrar(
      id,
      {
        ...dto,
        cajero_id: req.user.id,
      },
      sucursalId,
    );
  }

  @Patch(':id/convertir')
  @RequierePermiso('ventas.cotizacion.convertir')
  convertir(
    @Param('id') id: string,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.ventasService.convertirCotizacion(id, req.user.id, sucursalId);
  }

  @Patch(':id/cancelar')
  @RequierePermiso('ventas.cancelar')
  cancelar(
    @Param('id') id: string,
    @Request() req,
    @SucursalActiva() sucursalId: string,
    @Body('motivo') motivo?: string,
  ) {
    return this.ventasService.cancelar(id, req.user.id, sucursalId, motivo);
  }

  @Patch(':id/despachar')
  @RequierePermiso('deposito.despachar')
  despachar(
    @Param('id') id: string,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.ventasService.despachar(id, req.user.id, sucursalId);
  }
}
