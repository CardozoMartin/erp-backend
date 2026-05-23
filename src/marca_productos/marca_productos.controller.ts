import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { MarcaProductosService } from './marca_productos.service';
import { CreateMarcaProductoDto } from './dto/create-marca_producto.dto';
import { UpdateMarcaProductoDto } from './dto/update-marca_producto.dto';

@Controller('marca-productos')
export class MarcaProductosController {
  constructor(private readonly marcaProductosService: MarcaProductosService) {}

  @Post()
  create(@Body() createMarcaProductoDto: CreateMarcaProductoDto) {
    return this.marcaProductosService.create(createMarcaProductoDto);
  }

  @Get()
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '30',
  ) {
    return this.marcaProductosService.findAll(Number(page), Number(limit));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.marcaProductosService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMarcaProductoDto: UpdateMarcaProductoDto) {
    return this.marcaProductosService.update(id, updateMarcaProductoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.marcaProductosService.remove(id);
  }
}
