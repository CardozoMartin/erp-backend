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

@Controller('empleados')
export class EmpleadosController {
  constructor(
    private readonly empleadosService: EmpleadosService,
    private readonly empleadoSucursalesService: EmpleadoSucursalesService,
  ) {}

  @Post()
  create(
    @Body() createEmpleadoDto: CrearEmpleadoDto,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.empleadosService.create(createEmpleadoDto, req.user?.id, sucursalId);
  }

  @Get()
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '30',
  ) {
    return this.empleadosService.findAll(Number(page), Number(limit));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.empleadosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEmpleadoDto: UpdateEmpleadoDto,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.empleadosService.update(id, updateEmpleadoDto, req.user?.id, sucursalId);
  }

  @Patch(':id/roles')
  assignRoles(
    @Param('id') id: string,
    @Body() asignarRolesDto: AsignarRolesDto,
    @Request() req,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.empleadosService.asignarRoles(id, asignarRolesDto, req.user?.id, sucursalId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.empleadosService.remove(id);
  }

  // POST /empleados/:id/sucursales
  @Post(':id/sucursales')
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
  getSucursales(@Param('id') id: string) {
    return this.empleadoSucursalesService.findByEmpleado(id);
  }

  // PATCH /empleados/:id/sucursales/principal
  @Patch(':id/sucursales/principal')
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
}
