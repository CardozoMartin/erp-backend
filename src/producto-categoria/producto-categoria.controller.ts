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
import { CreateCategoriaAtributoDto } from './dto/create-categoria-atributo.dto';
import { UpdateCategoriaAtributoDto } from './dto/update-categoria-atributo.dto';

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
    @Query('limit') limit: string = '10',
  ) {
    return this.productoCategoriaService.findAllActivas(
      Number(page),
      Number(limit),
    );
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

  // ─── Endpoints para atributos ───
  @Post(':id/atributos')
  addAtributo(
    @Param('id') categoriaId: string,
    @Body() createAtributoDto: CreateCategoriaAtributoDto,
  ) {
    return this.productoCategoriaService.addAtributo(
      categoriaId,
      createAtributoDto,
    );
  }

  @Get(':id/atributos')
  getAtributosByCategoria(@Param('id') categoriaId: string) {
    return this.productoCategoriaService.getAtributosByCategoria(categoriaId);
  }

  @Patch('atributos/:atributoId')
  updateAtributo(
    @Param('atributoId') atributoId: string,
    @Body() updateAtributoDto: UpdateCategoriaAtributoDto,
  ) {
    return this.productoCategoriaService.updateAtributo(
      atributoId,
      updateAtributoDto,
    );
  }

  @Delete('atributos/:atributoId')
  removeAtributo(@Param('atributoId') atributoId: string) {
    return this.productoCategoriaService.removeAtributo(atributoId);
  }
}
