import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { VarianteService } from './variante.service';
import { CreateVarianteDto } from './dto/create-variante.dto';
import { UpdateVarianteDto } from './dto/update-variante.dto';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';

@Controller('variante')
export class VarianteController {
  constructor(private readonly varianteService: VarianteService) {}

  @Post()
  @RequierePermiso('variantes.crear')
  create(@Body() createVarianteDto: CreateVarianteDto) {
    return this.varianteService.create(createVarianteDto);
  }

  @Get()
  @RequierePermiso('variantes.ver')
  findAll() {
    return this.varianteService.findAll();
  }

  @Get(':id')
  @RequierePermiso('variantes.ver')
  findOne(@Param('id') id: string) {
    return this.varianteService.findOneOrFail(id);
  }

  @Patch(':id')
  @RequierePermiso('variantes.editar')
  update(@Param('id') id: string, @Body() updateVarianteDto: UpdateVarianteDto) {
    return this.varianteService.update(id, updateVarianteDto);
  }

  @Delete(':id')
  @RequierePermiso('variantes.eliminar')
  remove(@Param('id') id: string) {
    return this.varianteService.remove(id);
  }
}
