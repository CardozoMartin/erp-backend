import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { MarcaProductosService } from './marca_productos.service';
import { CreateMarcaProductoDto } from './dto/create-marca_producto.dto';
import { UpdateMarcaProductoDto } from './dto/update-marca_producto.dto';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';

@Controller('marca-productos')
export class MarcaProductosController {
  constructor(private readonly marcaProductosService: MarcaProductosService) {}

  @Post()
  @RequierePermiso('marcas.crear')
  create(@Body() createMarcaProductoDto: CreateMarcaProductoDto) {
    return this.marcaProductosService.create(createMarcaProductoDto);
  }

  @Get()
  @RequierePermiso('marcas.ver')
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '30',
  ) {
    return this.marcaProductosService.findAll(Number(page), Number(limit));
  }

  @Get(':id')
  @RequierePermiso('marcas.ver')
  findOne(@Param('id') id: string) {
    return this.marcaProductosService.findOne(id);
  }

  @Patch(':id')
  @RequierePermiso('marcas.editar')
  update(@Param('id') id: string, @Body() updateMarcaProductoDto: UpdateMarcaProductoDto) {
    return this.marcaProductosService.update(id, updateMarcaProductoDto);
  }

  @Delete(':id')
  @RequierePermiso('marcas.eliminar')
  remove(@Param('id') id: string) {
    return this.marcaProductosService.remove(id);
  }
}
