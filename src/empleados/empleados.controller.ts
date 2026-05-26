import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CrearEmpleadoDto, AsignarRolesDto } from './dto/create-empleado.dto';
import { UpdateEmpleadoDto } from './dto/update-empleado.dto';
import { EmpleadosService } from './empleados.service';
import { AsignarSucursalDto, DesasignarSucursalDto } from './dto/empleado-sucursal.dto';
import { EmpleadoSucursalesService } from './empleado-sucursales.service';

@Controller('empleados')
export class EmpleadosController {
  constructor(
    private readonly empleadosService: EmpleadosService,
    private readonly empleadoSucursalesService: EmpleadoSucursalesService,
  ) {}

  @Post()
  create(@Body() createEmpleadoDto: CrearEmpleadoDto) {
    return this.empleadosService.create(createEmpleadoDto);
  }

  @Get()
  findAll() {
    return this.empleadosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.empleadosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEmpleadoDto: UpdateEmpleadoDto,
  ) {
    return this.empleadosService.update(id, updateEmpleadoDto);
  }

  @Patch(':id/roles')
  assignRoles(
    @Param('id') id: string,
    @Body() asignarRolesDto: AsignarRolesDto,
  ) {
    return this.empleadosService.asignarRoles(id, asignarRolesDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.empleadosService.remove(id);
  }

  // POST /empleados/:id/sucursales
  @Post(':id/sucursales')
  asignarSucursal(@Param('id') id: string, @Body() dto: AsignarSucursalDto) {
    return this.empleadoSucursalesService.asignar(
      id,
      dto.sucursalId,
      dto.esPrincipal,
    );
  }

  // GET /empleados/:id/sucursales
  @Get(':id/sucursales')
  getSucursales(@Param('id') id: string) {
    return this.empleadoSucursalesService.findByEmpleado(id);
  }

  // PATCH /empleados/:id/sucursales/principal
  @Patch(':id/sucursales/principal')
  setPrincipal(@Param('id') id: string, @Body() dto: AsignarSucursalDto) {
    return this.empleadoSucursalesService.setPrincipal(id, dto.sucursalId);
  }

  // DELETE /empleados/:id/sucursales
  @Delete(':id/sucursales')
  desasignar(@Param('id') id: string, @Body() dto: DesasignarSucursalDto) {
    return this.empleadoSucursalesService.desasignar(id, dto.sucursalId);
  }
}
