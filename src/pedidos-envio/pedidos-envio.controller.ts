import { Body, Controller, Get, Param, Patch, Post, Request } from '@nestjs/common';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';
import {
  CambiarEstadoPedidoEnvioDto,
  CrearPedidoEnvioDto,
  EditarPedidoEnvioDto,
  RendirPedidoEnvioDto,
} from './dto/pedido-envio.dto';
import { PedidosEnvioService } from './pedidos-envio.service';

@Controller('pedidos-envio')
export class PedidosEnvioController {
  constructor(private readonly pedidosEnvioService: PedidosEnvioService) {}

  @Post()
  @RequierePermiso('ventas.crear')
  crear(
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: CrearPedidoEnvioDto,
  ) {
    return this.pedidosEnvioService.crear(sucursalId, req.user.id, dto);
  }

  @Get()
  @RequierePermiso('ventas.ver')
  findAll(@SucursalActiva() sucursalId: string) {
    return this.pedidosEnvioService.findAll(sucursalId);
  }

  @Get(':id')
  @RequierePermiso('ventas.ver')
  findOne(@Param('id') id: string, @SucursalActiva() sucursalId: string) {
    return this.pedidosEnvioService.findOne(id, sucursalId);
  }

  @Patch(':id')
  @RequierePermiso('ventas.crear')
  editar(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: EditarPedidoEnvioDto,
  ) {
    return this.pedidosEnvioService.editar(id, sucursalId, req.user.id, dto);
  }

  @Patch(':id/estado')
  @RequierePermiso('ventas.crear')
  cambiarEstado(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: CambiarEstadoPedidoEnvioDto,
  ) {
    return this.pedidosEnvioService.cambiarEstado(id, sucursalId, req.user.id, dto);
  }

  @Patch(':id/rendir')
  @RequierePermiso('ventas.crear')
  rendir(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: RendirPedidoEnvioDto,
  ) {
    return this.pedidosEnvioService.rendir(id, sucursalId, req.user.id, dto);
  }
}
