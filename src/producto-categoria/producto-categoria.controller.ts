import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProductoCategoriaService } from './producto-categoria.service';
import { CreateProductoCategoriaDto } from './dto/create-producto-categoria.dto';
import { UpdateProductoCategoriaDto } from './dto/update-producto-categoria.dto';

@Controller('producto-categoria')
export class ProductoCategoriaController {
  constructor(private readonly productoCategoriaService: ProductoCategoriaService) {}

  @Post()
  create(@Body() createProductoCategoriaDto: CreateProductoCategoriaDto) {
    return this.productoCategoriaService.create(createProductoCategoriaDto);
  }

  @Get()
  findAll() {
    return this.productoCategoriaService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productoCategoriaService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductoCategoriaDto: UpdateProductoCategoriaDto) {
    return this.productoCategoriaService.update(id, updateProductoCategoriaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productoCategoriaService.remove(id);
  }
}
