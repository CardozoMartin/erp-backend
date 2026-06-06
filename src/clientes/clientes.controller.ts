// clientes/clientes.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { CreatePlanPagoDto } from './dto/create-cliente.dto';
import {
  CalcularRecargosCuentaDto,
  RegistrarAjusteCuentaDto,
  RegistrarCargoCuentaDto,
  RegistrarNotaCreditoCuentaDto,
  RegistrarPagoCuentaDto,
} from './dto/cuenta-corriente-operacion.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';
import { SucursalGuard } from 'src/sucursal/decorators/sucursal.guard';

@UseGuards(JwtAuthGuard, SucursalGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  @Post()
  create(@Body() dto: CreateClienteDto, @Request() req, @SucursalActiva() sucursalId: string) {
    return this.service.create(dto, req.user?.id, sucursalId);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto, @Request() req, @SucursalActiva() sucursalId: string) {
    return this.service.update(id, dto, req.user?.id, sucursalId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req, @SucursalActiva() sucursalId: string) {
    return this.service.remove(id, req.user?.id, sucursalId);
  }

  @Post(':id/cuenta-corriente')
  activarCuentaCorriente(
    @Param('id') id: string,
    @Body() body: { limite_credito: number; planPago?: CreatePlanPagoDto },
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.service.activarCuentaCorriente(
      id,
      body.limite_credito,
      body.planPago,
      req.user?.id,
      sucursalId,
    );
  }

  @Get(':id/movimientos')
  getMovimientos(@Param('id') id: string) {
    return this.service.getMovimientos(id);
  }

  @Post(':id/cargo')
  registrarCargo(
    @Param('id') id: string,
    @Body() dto: RegistrarCargoCuentaDto,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.service.registrarCargoManual(id, dto, req.user?.id, sucursalId);
  }

  @Post(':id/pago')
  registrarPago(
    @Param('id') id: string,
    @Body() dto: RegistrarPagoCuentaDto,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.service.registrarPagoManual(id, dto, req.user?.id, sucursalId);
  }

  @Post(':id/nota-credito')
  registrarNotaCredito(
    @Param('id') id: string,
    @Body() dto: RegistrarNotaCreditoCuentaDto,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.service.registrarNotaCredito(id, dto, req.user?.id, sucursalId);
  }

  @Post(':id/ajuste')
  registrarAjuste(
    @Param('id') id: string,
    @Body() dto: RegistrarAjusteCuentaDto,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.service.registrarAjuste(id, dto, req.user?.id, sucursalId);
  }

  @Post(':id/recargos')
  calcularRecargos(
    @Param('id') id: string,
    @Body() dto: CalcularRecargosCuentaDto,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.service.calcularRecargos(id, dto, req.user?.id, sucursalId);
  }

  @Patch('movimientos/:movimientoId/omitir-recargo')
  omitirRecargo(
    @Param('movimientoId') movimientoId: string,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.service.omitirRecargo(movimientoId, req.user.id, sucursalId);
  }
}
