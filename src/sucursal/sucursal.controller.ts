import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { SucursalService } from './sucursal.service';
import {
  CreateSucursalDto,
  UpdateSucursalDto,
} from './dto/create-sucursal.dto';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';

@Controller('sucursales')
export class SucursalController {
  constructor(private readonly sucursalService: SucursalService) {}

  @RequierePermiso('sucursales.ver')
  @Get()
  findAll() {
    return this.sucursalService.findAll();
  }
  @RequierePermiso('sucursales.ver')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sucursalService.findOne(id);
  }

  @Post()
  @RequierePermiso('sucursales.crear')
  create(@Body() createSucursalDto: CreateSucursalDto) {
    return this.sucursalService.create(createSucursalDto);
  }

  @RequierePermiso('sucursales.editar')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSucursalDto: UpdateSucursalDto,
  ) {
    return this.sucursalService.update(id, updateSucursalDto);
  }

  @RequierePermiso('sucursales.eliminar')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sucursalService.remove(id);
  }
}
