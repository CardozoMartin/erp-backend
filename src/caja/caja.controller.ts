import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';
import {
  AbrirCajaDto,
  CajaQueryDto,
  CerrarCajaDto,
  ConsumoInternoCajaDto,
  RegistrarMovimientoCajaDto,
} from './dto/create-caja.dto';
import { CajaService } from './caja.service';
import { PdfService } from 'src/pdf/pdf.service';

@Controller('caja')
export class CajaController {
  constructor(
    private readonly cajaService: CajaService,
    private readonly pdfService: PdfService,
  ) {}

  private puedeVerTodasLasCajas(req: any): boolean {
    return (
      req.user?.permisos?.includes('reportes.ver') ||
      req.user?.permisos?.includes('reportes.caja') ||
      req.user?.permisos?.includes('config.pos')
    );
  }

  @Post('abrir')
  @RequierePermiso('caja.abrir')
  abrir(
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: AbrirCajaDto,
  ) {
    return this.cajaService.abrir(sucursalId, req.user.id, dto);
  }

  @Get('abierta')
  findAbierta(@SucursalActiva() sucursalId: string, @Request() req) {
    return this.cajaService.findAbiertaPorEmpleado(sucursalId, req.user.id);
  }

  @Get('abiertas')
  @RequierePermiso('caja.cobrar')
  findAbiertas(@SucursalActiva() sucursalId: string) {
    return this.cajaService.findAll(sucursalId, { soloAbiertas: true });
  }

  @Get()
  @RequierePermiso('caja.ver')
  findAll(
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Query() query: CajaQueryDto,
  ) {
    const puedeVerTodas = this.puedeVerTodasLasCajas(req);
    return this.cajaService.findAll(sucursalId, {
      empleadoId: puedeVerTodas ? undefined : req.user.id,
      soloAbiertas: !puedeVerTodas,
      desde: puedeVerTodas ? query.desde : undefined,
      hasta: puedeVerTodas ? query.hasta : undefined,
      estado: puedeVerTodas ? query.estado : undefined,
    });
  }

  @Get(':id/pdf')
  @RequierePermiso('caja.ver')
  async pdf(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const resumen = await this.cajaService.resumen(
      id,
      sucursalId,
      this.puedeVerTodasLasCajas(req) ? undefined : req.user.id,
    );
    const buffer = await this.pdfService.generarCierreCajaPdfConDatos(resumen, sucursalId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="caja-${id.slice(0, 8)}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get(':id/resumen')
  @RequierePermiso('caja.ver')
  resumen(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
  ) {
    return this.cajaService.resumen(
      id,
      sucursalId,
      this.puedeVerTodasLasCajas(req) ? undefined : req.user.id,
    );
  }

  @Get(':id')
  @RequierePermiso('caja.ver')
  findOne(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
  ) {
    return this.cajaService.findOne(
      id,
      sucursalId,
      this.puedeVerTodasLasCajas(req) ? undefined : req.user.id,
    );
  }

  @Post(':id/movimientos')
  @RequierePermiso('caja.movimientos.crear')
  registrarMovimiento(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: RegistrarMovimientoCajaDto,
  ) {
    return this.cajaService.registrarMovimientoManual(
      id,
      sucursalId,
      req.user.id,
      dto,
    );
  }

  @Patch(':id/cerrar')
  @RequierePermiso('caja.cerrar')
  cerrar(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: CerrarCajaDto,
  ) {
    return this.cajaService.cerrar(id, sucursalId, req.user.id, dto);
  }

  @Post(':id/consumo-interno')
  @RequierePermiso('caja.movimientos.crear')
  consumoInterno(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: ConsumoInternoCajaDto,
  ) {
    return this.cajaService.consumoInterno(id, sucursalId, req.user.id, dto);
  }
}
