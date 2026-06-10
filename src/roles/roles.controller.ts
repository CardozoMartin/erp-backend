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

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  create(@Body() createRoleDto: CrearRoleDto, @Request() req) {
    return this.rolesService.create(createRoleDto, req.user?.id);
  }

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto, @Request() req) {
    return this.rolesService.update(id, updateRoleDto, req.user?.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.rolesService.remove(id, req.user?.id);
  }
}
