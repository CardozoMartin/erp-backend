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
} from '@nestjs/common';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';
import { CrearEmpleadoDto, AsignarRolesDto } from './dto/create-empleado.dto';
import { UpdateEmpleadoDto } from './dto/update-empleado.dto';
import { EmpleadosService } from './empleados.service';
import {
  AsignarSucursalDto,
  DesasignarSucursalDto,
} from './dto/empleado-sucursal.dto';
import { EmpleadoSucursalesService } from './empleado-sucursales.service';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { AsignarPermisoDto } from './dto/empleado-permiso.dto';

@Controller('empleados')
export class EmpleadosController {
  constructor(
    private readonly empleadosService: EmpleadosService,
    private readonly empleadoSucursalesService: EmpleadoSucursalesService,
  ) {}

  @Post()
  @RequierePermiso('empleados.crear')
  create(
    @Body() createEmpleadoDto: CrearEmpleadoDto,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.empleadosService.create(
      createEmpleadoDto,
      req.user?.id,
      sucursalId,
    );
  }

  @Get()
  @RequierePermiso('empleados.ver')
  findAll(
    @SucursalActiva() sucursalId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '30',
  ) {
    return this.empleadosService.findAll(sucursalId, Number(page), Number(limit));
  }

  @Get(':id')
  @RequierePermiso('empleados.ver')
  findOne(@Param('id') id: string) {
    return this.empleadosService.findOne(id);
  }

  @Patch(':id')
  @RequierePermiso('empleados.editar')
  update(
    @Param('id') id: string,
    @Body() updateEmpleadoDto: UpdateEmpleadoDto,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.empleadosService.update(
      id,
      updateEmpleadoDto,
      req.user?.id,
      sucursalId,
    );
  }

  @Patch(':id/roles')
  @RequierePermiso('empleados.roles')
  assignRoles(
    @Param('id') id: string,
    @Body() asignarRolesDto: AsignarRolesDto,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.empleadosService.asignarRoles(
      id,
      asignarRolesDto,
      req.user?.id,
      sucursalId,
    );
  }

  @Patch(':id/reset-password')
  @RequierePermiso('empleados.editar')
  resetPassword(
    @Param('id') id: string,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.empleadosService.resetPassword(id, req.user?.id, sucursalId);
  }

  @Delete(':id')
  @RequierePermiso('empleados.eliminar')
  remove(@Param('id') id: string) {
    return this.empleadosService.remove(id);
  }

  // POST /empleados/:id/sucursales
  @Post(':id/sucursales')
  @RequierePermiso('empleados.editar')
  asignarSucursal(
    @Param('id') id: string,
    @Body() dto: AsignarSucursalDto,
    @Request() req,
    @SucursalActiva() sucursalActivaId: string,
  ) {
    return this.empleadoSucursalesService.asignar(
      id,
      dto.sucursalId,
      dto.esPrincipal,
      req.user?.id,
      sucursalActivaId,
    );
  }

  // GET /empleados/:id/sucursales
  @Get(':id/sucursales')
  @RequierePermiso('empleados.ver')
  getSucursales(@Param('id') id: string) {
    return this.empleadoSucursalesService.findByEmpleado(id);
  }

  // PATCH /empleados/:id/sucursales/principal
  @Patch(':id/sucursales/principal')
  @RequierePermiso('empleados.editar')
  setPrincipal(
    @Param('id') id: string,
    @Body() dto: AsignarSucursalDto,
    @Request() req,
    @SucursalActiva() sucursalActivaId: string,
  ) {
    return this.empleadoSucursalesService.setPrincipal(
      id,
      dto.sucursalId,
      req.user?.id,
      sucursalActivaId,
    );
  }

  // DELETE /empleados/:id/sucursales
  @Delete(':id/sucursales')
  @RequierePermiso('empleados.editar')
  desasignar(
    @Param('id') id: string,
    @Body() dto: DesasignarSucursalDto,
    @Request() req,
    @SucursalActiva() sucursalActivaId: string,
  ) {
    return this.empleadoSucursalesService.desasignar(
      id,
      dto.sucursalId,
      req.user?.id,
      sucursalActivaId,
    );
  }

  // POST /empleados/:id/permisos
  @Post(':id/permisos')
  @RequierePermiso('empleados.permisos')
  asignarPermiso(
    @Param('id') id: string,
    @Body() dto: AsignarPermisoDto,
    @Request() req,
    @SucursalActiva() sucursalActivaId: string,
  ) {
    return this.empleadosService.asignarPermisoExtra(
      id,
      dto,
      req.user?.id,
      sucursalActivaId,
    );
  }

  // DELETE /empleados/:id/permisos/:permisoId
  @Delete(':id/permisos/:permisoId')
  @RequierePermiso('empleados.permisos')
  removerPermiso(
    @Param('id') id: string,
    @Param('permisoId') permisoId: string,
    @Request() req,
    @SucursalActiva() sucursalActivaId: string,
  ) {
    return this.empleadosService.removerPermisoExtra(
      id,
      permisoId,
      req.user?.id,
      sucursalActivaId,
    );
  }
}
