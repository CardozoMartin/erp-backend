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
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SucursalGuard } from 'src/sucursal/decorators/sucursal.guard';

@UseGuards(JwtAuthGuard, SucursalGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  @Post()
  create(@Body() dto: CreateClienteDto) {
    return this.service.create(dto);
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
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/cuenta-corriente')
  activarCuentaCorriente(
    @Param('id') id: string,
    @Body() body: { limite_credito: number; planPago?: CreatePlanPagoDto },
  ) {
    return this.service.activarCuentaCorriente(
      id,
      body.limite_credito,
      body.planPago,
    );
  }

  @Get(':id/movimientos')
  getMovimientos(@Param('id') id: string) {
    return this.service.getMovimientos(id);
  }

  @Post(':id/pago')
  registrarPago(
    @Param('id') id: string,
    @Body() body: { monto: number; descripcion?: string },
  ) {
    return this.service.registrarPago(id, body.monto, body.descripcion);
  }

  @Patch('movimientos/:movimientoId/omitir-recargo')
  omitirRecargo(@Param('movimientoId') movimientoId: string, @Request() req) {
    return this.service.omitirRecargo(movimientoId, req.user.sub);
  }
}
