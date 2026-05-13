import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ProductoCategoriaService } from './producto-categoria.service';
import { CreateProductoCategoriaDto } from './dto/create-producto-categoria.dto';
import { UpdateProductoCategoriaDto } from './dto/update-producto-categoria.dto';

@Controller('producto-categoria')
export class ProductoCategoriaController {
  constructor(
    private readonly productoCategoriaService: ProductoCategoriaService,
  ) {}

  @Post()
  create(@Body() createProductoCategoriaDto: CreateProductoCategoriaDto) {
    console.log('DTO recibido:', createProductoCategoriaDto);
    return this.productoCategoriaService.create(createProductoCategoriaDto);
  }

  @Get()
  findAll() {
    return this.productoCategoriaService.findAll();
  }
  @Get('activas')
  findAllActivas(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10'
  ) {
    return this.productoCategoriaService.findAllActivas(Number(page), Number(limit));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productoCategoriaService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProductoCategoriaDto: UpdateProductoCategoriaDto,
  ) {
    return this.productoCategoriaService.update(id, updateProductoCategoriaDto);
  }

  @Patch(':id/toggle-activo')
  toggleActivo(@Param('id') id: string) {
    return this.productoCategoriaService.toggleActivo(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productoCategoriaService.remove(id);
  }
}
