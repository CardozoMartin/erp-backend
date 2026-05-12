import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { VarianteService } from './variante.service';
import { CreateVarianteDto } from './dto/create-variante.dto';
import { UpdateVarianteDto } from './dto/update-variante.dto';

@Controller('variante')
export class VarianteController {
  constructor(private readonly varianteService: VarianteService) {}

  @Post()
  create(@Body() createVarianteDto: CreateVarianteDto) {
    return this.varianteService.create(createVarianteDto);
  }

  @Get()
  findAll() {
    return this.varianteService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.varianteService.findOneOrFail(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVarianteDto: UpdateVarianteDto) {
    return this.varianteService.update(id, updateVarianteDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.varianteService.remove(id);
  }
}
