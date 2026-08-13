import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { OfertaService } from './oferta.service';
import { CreateOfertaDto } from './dto/create-oferta.dto';
import { UpdateOfertaDto } from './dto/update-oferta.dto';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';

@Controller('oferta')
export class OfertaController {
  constructor(private readonly ofertaService: OfertaService) {}

  @Post()
  @RequierePermiso('ofertas.crear')
  create(@Body() createOfertaDto: CreateOfertaDto) {
    return this.ofertaService.create(createOfertaDto);
  }

  @Get()
  @RequierePermiso('ofertas.ver')
  findAll() {
    return this.ofertaService.findAll();
  }

  @Get('vigente/:productoId')
  @RequierePermiso('ofertas.ver')
  findVigente(
    @Param('productoId') productoId: string,
    @Query('varianteId') varianteId?: string,
  ) {
    return this.ofertaService.findVigenteParaProducto(productoId, varianteId);
  }

  @Get(':id')
  @RequierePermiso('ofertas.ver')
  findOne(@Param('id') id: string) {
    return this.ofertaService.findOneOrFail(id);
  }

  @Patch(':id')
  @RequierePermiso('ofertas.editar')
  update(@Param('id') id: string, @Body() updateOfertaDto: UpdateOfertaDto) {
    return this.ofertaService.update(id, updateOfertaDto);
  }

  @Delete(':id')
  @RequierePermiso('ofertas.eliminar')
  remove(@Param('id') id: string) {
    return this.ofertaService.remove(id);
  }
}
