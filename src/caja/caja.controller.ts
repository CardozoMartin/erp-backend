import { Body, Controller, Get, Param, Patch, Post, Request } from '@nestjs/common';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';
import {
  AbrirCajaDto,
  CerrarCajaDto,
  RegistrarMovimientoCajaDto,
} from './dto/create-caja.dto';
import { CajaService } from './caja.service';

@Controller('caja')
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}

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

  @Get()
  @RequierePermiso('caja.ver')
  findAll(@SucursalActiva() sucursalId: string, @Request() req) {
    return this.cajaService.findAll(
      sucursalId,
      this.puedeVerTodasLasCajas(req) ? undefined : req.user.id,
    );
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
}
