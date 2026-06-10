import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';
import { AuditoriaService } from './auditoria.service';

@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @RequierePermiso('reportes.ver')
  findAll(
    @SucursalActiva() sucursalId: string,
    @Query('modulo') modulo?: string,
    @Query('accion') accion?: string,
    @Query('empleado_id') empleadoId?: string,
    @Query('entidad') entidad?: string,
    @Query('entidad_id') entidadId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditoriaService.findAll({
      modulo,
      accion,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      entidad,
      entidad_id: entidadId,
      desde,
      hasta,
      q,
      page: Number(page ?? 1),
      limit: Number(limit ?? 50),
    });
  }

  @Get('historial/:entidad/:entidadId')
  @RequierePermiso('reportes.ver')
  historialEntidad(
    @SucursalActiva() sucursalId: string,
    @Param('entidad') entidad: string,
    @Param('entidadId') entidadId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditoriaService.findHistorialEntidad({
      entidad,
      entidad_id: entidadId,
      sucursal_id: sucursalId,
      page: Number(page ?? 1),
      limit: Number(limit ?? 100),
    });
  }
}
