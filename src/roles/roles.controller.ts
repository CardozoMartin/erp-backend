import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CrearRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @RequierePermiso('roles.crear')
  create(@Body() createRoleDto: CrearRoleDto, @Request() req) {
    return this.rolesService.create(createRoleDto, req.user?.id);
  }

  @Get()
  @RequierePermiso('roles.ver')
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @RequierePermiso('roles.ver')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  @RequierePermiso('roles.editar')
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto, @Request() req) {
    return this.rolesService.update(id, updateRoleDto, req.user?.id);
  }

  @Delete(':id')
  @RequierePermiso('roles.eliminar')
  remove(@Param('id') id: string, @Request() req) {
    return this.rolesService.remove(id, req.user?.id);
  }
}
