// clientes/clientes.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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
import { EnviarResumenCuentaDto, TipoResumenCuenta } from './dto/enviar-resumen-cuenta.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';
import { SucursalGuard } from 'src/sucursal/decorators/sucursal.guard';
import { PdfService } from 'src/pdf/pdf.service';

@UseGuards(JwtAuthGuard, SucursalGuard)
@Controller('clientes')
export class ClientesController {
  constructor(
    private readonly service: ClientesService,
    private readonly pdfService: PdfService,
  ) {}

  @Post()
  @RequierePermiso('clientes.cargar')
  create(@Body() dto: CreateClienteDto, @Request() req, @SucursalActiva() sucursalId: string) {
    return this.service.create(dto, req.user?.id, sucursalId);
  }

  @Get()
  @RequierePermiso('clientes.ver')
  findAll(@Query('activo') activo?: string) {
    const filtroActivo = activo === 'true' ? true : activo === 'false' ? false : undefined;
    return this.service.findAll(filtroActivo);
  }

  @Get(':id')
  @RequierePermiso('clientes.ver')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequierePermiso('clientes.editar')
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto, @Request() req, @SucursalActiva() sucursalId: string) {
    return this.service.update(id, dto, req.user?.id, sucursalId);
  }

  @Delete(':id')
  @RequierePermiso('clientes.eliminar')
  remove(@Param('id') id: string, @Request() req, @SucursalActiva() sucursalId: string) {
    return this.service.remove(id, req.user?.id, sucursalId);
  }

  @Patch(':id/toggle-activo')
  @RequierePermiso('clientes.editar')
  toggleActivo(@Param('id') id: string, @Request() req, @SucursalActiva() sucursalId: string) {
    return this.service.toggleActivo(id, req.user?.id, sucursalId);
  }

  @Patch(':id/cuenta-corriente/toggle')
  @RequierePermiso('clientes.cuenta_corriente.operar')
  toggleCuentaCorriente(@Param('id') id: string, @Request() req, @SucursalActiva() sucursalId: string) {
    return this.service.toggleCuentaCorriente(id, req.user?.id, sucursalId);
  }

  @Patch(':id/bloqueo')
  @RequierePermiso('clientes.editar')
  setBloqueo(
    @Param('id') id: string,
    @Body() body: { bloqueado: boolean; razon?: string },
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.service.setBloqueo(id, body.bloqueado, body.razon ?? null, req.user?.id, sucursalId);
  }

  @Patch(':id/accion-legal')
  @RequierePermiso('clientes.editar')
  setAccionLegal(
    @Param('id') id: string,
    @Body() body: { accion_legal: boolean },
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.service.setAccionLegal(id, body.accion_legal, req.user?.id, sucursalId);
  }

  @Post(':id/cuenta-corriente')
  @RequierePermiso('clientes.cuenta_corriente.operar')
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
  @RequierePermiso('clientes.cuenta_corriente.ver')
  getMovimientos(@Param('id') id: string) {
    return this.service.getMovimientos(id);
  }

  @Get(':id/cuenta-corriente/pdf')
  @RequierePermiso('clientes.ver')
  async pdfResumenCuenta(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('tipo_resumen') tipoResumen?: TipoResumenCuenta,
    @Res() res?: Response,
  ) {
    const cliente = await this.service.findOne(id);
    const movimientos = await this.service.getMovimientos(id);
    const filtrados = this.service['filtrarMovimientosResumen'](movimientos, {
      destino: '',
      desde,
      hasta,
      tipo_resumen: tipoResumen ?? TipoResumenCuenta.TODOS,
    });
    const buffer = await this.pdfService.generarResumenCuentaCorrientePdf(
      cliente,
      filtrados,
      {
        periodo: desde && hasta ? `${desde} al ${hasta}` : 'Todos los períodos',
        tipoResumen: tipoResumen ?? 'TODOS',
        config: null,
      },
    );
    res!.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="cuenta-corriente-${id.slice(0, 8)}.pdf"`,
      'Content-Length': buffer.length,
    });
    res!.end(buffer);
  }

  @Post(':id/cuenta-corriente/enviar-resumen')
  @RequierePermiso('clientes.enviar_email')
  enviarResumenCuenta(
    @Param('id') id: string,
    @Body() dto: EnviarResumenCuentaDto,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.service.enviarResumenCuentaCorriente(id, dto, req.user?.id, sucursalId);
  }

  @Post(':id/cargo')
  @RequierePermiso('clientes.cuenta_corriente.operar')
  registrarCargo(
    @Param('id') id: string,
    @Body() dto: RegistrarCargoCuentaDto,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.service.registrarCargoManual(id, dto, req.user?.id, sucursalId);
  }

  @Post(':id/pago')
  @RequierePermiso('clientes.cuenta_corriente.operar')
  registrarPago(
    @Param('id') id: string,
    @Body() dto: RegistrarPagoCuentaDto,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.service.registrarPagoManual(id, dto, req.user?.id, sucursalId);
  }

  @Post(':id/nota-credito')
  @RequierePermiso('clientes.cuenta_corriente.operar')
  registrarNotaCredito(
    @Param('id') id: string,
    @Body() dto: RegistrarNotaCreditoCuentaDto,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.service.registrarNotaCredito(id, dto, req.user?.id, sucursalId);
  }

  @Post(':id/ajuste')
  @RequierePermiso('clientes.cuenta_corriente.operar')
  registrarAjuste(
    @Param('id') id: string,
    @Body() dto: RegistrarAjusteCuentaDto,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.service.registrarAjuste(id, dto, req.user?.id, sucursalId);
  }

  @Post(':id/recargos')
  @RequierePermiso('clientes.cuenta_corriente.operar')
  calcularRecargos(
    @Param('id') id: string,
    @Body() dto: CalcularRecargosCuentaDto,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.service.calcularRecargos(id, dto, req.user?.id, sucursalId);
  }

  @Patch('movimientos/:movimientoId/omitir-recargo')
  @RequierePermiso('clientes.cuenta_corriente.operar')
  omitirRecargo(
    @Param('movimientoId') movimientoId: string,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.service.omitirRecargo(movimientoId, req.user.id, sucursalId);
  }
}
