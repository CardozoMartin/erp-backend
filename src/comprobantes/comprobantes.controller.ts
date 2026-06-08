import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';
import { ComprobantesService } from './comprobantes.service';
import {
  CambiarEstadoComprobanteDto,
  CreateComprobanteDto,
} from './dto/create-comprobante.dto';
import { EnviarComprobanteEmailDto } from './dto/enviar-comprobante-email.dto';
import { UpdateComprobanteDto } from './dto/update-comprobante.dto';
import { TipoComprobante } from './entities/comprobante.entity';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';

@Controller('comprobantes')
export class ComprobantesController {
  constructor(private readonly comprobantesService: ComprobantesService) {}

  @Post()
  create(
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: CreateComprobanteDto,
  ) {
    return this.comprobantesService.create(sucursalId, req.user.id, dto);
  }

  @Get()
  findAll(
    @SucursalActiva() sucursalId: string,
    @Query('tipo') tipo?: TipoComprobante,
  ) {
    return this.comprobantesService.findAll(sucursalId, tipo);
  }

  @Get('numeradores')
  verNumeradores(@SucursalActiva() sucursalId: string) {
    return this.comprobantesService.verNumeradores(sucursalId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @SucursalActiva() sucursalId: string) {
    return this.comprobantesService.findOne(id, sucursalId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: UpdateComprobanteDto,
  ) {
    return this.comprobantesService.update(id, sucursalId, dto, req.user?.id);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: CambiarEstadoComprobanteDto,
  ) {
    return this.comprobantesService.cambiarEstado(id, sucursalId, dto, req.user?.id);
  }

  @Post(':id/enviar-email')
  @RequierePermiso('ventas.ver')
  enviarEmail(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: EnviarComprobanteEmailDto,
  ) {
    return this.comprobantesService.enviarPorEmail(id, sucursalId, dto, req.user?.id);
  }
}
