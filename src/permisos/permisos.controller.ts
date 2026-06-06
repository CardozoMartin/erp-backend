import { Controller, Get, Post, Body, Patch, Param, Delete, Request } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { CrearPermisoDto } from './dto/create-permiso.dto';
import { UpdatePermisoDto } from './dto/update-permiso.dto';

@Controller('permisos')
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  @Post()
  create(@Body() createPermisoDto: CrearPermisoDto, @Request() req) {
    return this.permisosService.create(createPermisoDto, req.user?.id);
  }

  @Get()
  findAll() {
    return this.permisosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.permisosService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePermisoDto: UpdatePermisoDto, @Request() req) {
    return this.permisosService.update(id, updatePermisoDto, req.user?.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.permisosService.remove(id, req.user?.id);
  }
}
