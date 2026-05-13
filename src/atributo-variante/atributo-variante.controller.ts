import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AtributoVarianteService } from './atributo-variante.service';
import { CreateAtributoVarianteDto } from './dto/create-atributo-variante.dto';
import { UpdateAtributoVarianteDto } from './dto/update-atributo-variante.dto';

@Controller('atributo-variante')
export class AtributoVarianteController {
  constructor(private readonly atributoVarianteService: AtributoVarianteService) {}

  @Post()
  create(@Body() createAtributoVarianteDto: CreateAtributoVarianteDto) {
    return this.atributoVarianteService.create(createAtributoVarianteDto);
  }

  @Get()
  findAll() {
    return this.atributoVarianteService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.atributoVarianteService.findOneOrFail(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAtributoVarianteDto: UpdateAtributoVarianteDto) {
    return this.atributoVarianteService.update(id, updateAtributoVarianteDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.atributoVarianteService.remove(id);
  }
}
