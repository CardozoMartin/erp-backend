import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AtributoVarianteService } from './atributo-variante.service';
import { CreateAtributoVarianteDto } from './dto/create-atributo-variante.dto';
import { UpdateAtributoVarianteDto } from './dto/update-atributo-variante.dto';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';

@Controller('atributo-variante')
export class AtributoVarianteController {
  constructor(private readonly atributoVarianteService: AtributoVarianteService) {}

  @Post()
  @RequierePermiso('variantes.editar')
  create(@Body() createAtributoVarianteDto: CreateAtributoVarianteDto) {
    return this.atributoVarianteService.create(createAtributoVarianteDto);
  }

  @Get()
  @RequierePermiso('variantes.ver')
  findAll() {
    return this.atributoVarianteService.findAll();
  }

  @Get(':id')
  @RequierePermiso('variantes.ver')
  findOne(@Param('id') id: string) {
    return this.atributoVarianteService.findOneOrFail(id);
  }

  @Patch(':id')
  @RequierePermiso('variantes.editar')
  update(@Param('id') id: string, @Body() updateAtributoVarianteDto: UpdateAtributoVarianteDto) {
    return this.atributoVarianteService.update(id, updateAtributoVarianteDto);
  }

  @Delete(':id')
  @RequierePermiso('variantes.editar')
  remove(@Param('id') id: string) {
    return this.atributoVarianteService.remove(id);
  }
}
