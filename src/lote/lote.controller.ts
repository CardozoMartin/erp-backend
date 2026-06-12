import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { LoteService } from './lote.service';
import { CreateLoteDto } from './dto/create-lote.dto';
import { UpdateLoteDto } from './dto/update-lote.dto';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';

@Controller('lote')
export class LoteController {
  constructor(private readonly loteService: LoteService) {}

  @Post()
  @RequierePermiso('lotes.crear')
  create(@Body() createLoteDto: CreateLoteDto) {
    return this.loteService.create(createLoteDto);
  }

  @Get()
  @RequierePermiso('lotes.ver')
  findAll() {
    return this.loteService.findAll();
  }

  @Get(':id')
  @RequierePermiso('lotes.ver')
  findOne(@Param('id') id: string) {
    return this.loteService.findOneOrFail(id);
  }

  @Patch(':id')
  @RequierePermiso('lotes.editar')
  update(@Param('id') id: string, @Body() updateLoteDto: UpdateLoteDto) {
    return this.loteService.update(id, updateLoteDto);
  }

  @Delete(':id')
  @RequierePermiso('lotes.eliminar')
  remove(@Param('id') id: string) {
    return this.loteService.remove(id);
  }
}
