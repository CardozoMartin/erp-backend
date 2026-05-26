// ventas/ventas.controller.ts
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { VentasService } from './ventas-modulo.service';
import { CobrarVentaDto, CrearVentaDto } from './dto/create-ventas-modulo.dto';


@Controller('ventas')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Post()
  crear(@Body() dto: CrearVentaDto) {
    return this.ventasService.crear(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ventasService.findOne(id);
  }

  @Get('sucursal/:sucursalId')
  findBySucursal(@Param('sucursalId') sucursalId: string) {
    return this.ventasService.findBySucursal(sucursalId);
  }

  @Patch(':id/cobrar')
  cobrar(@Param('id') id: string, @Body() dto: CobrarVentaDto) {
    return this.ventasService.cobrar(id, dto);
  }

  @Patch(':id/convertir')
  convertir(@Param('id') id: string, @Body('empleado_id') empleadoId: string) {
    return this.ventasService.convertirCotizacion(id, empleadoId);
  }

  @Patch(':id/cancelar')
  cancelar(
    @Param('id') id: string,
    @Body('empleado_id') empleadoId: string,
    @Body('motivo') motivo?: string,
  ) {
    return this.ventasService.cancelar(id, empleadoId, motivo);
  }

  @Patch(':id/despachar')
  despachar(@Param('id') id: string, @Body('empleado_id') empleadoId: string) {
    return this.ventasService.despachar(id, empleadoId);
  }
}
