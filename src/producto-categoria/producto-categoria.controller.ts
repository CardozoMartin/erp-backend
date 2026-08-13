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
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';

@Controller('producto-categoria')
export class ProductoCategoriaController {
  constructor(
    private readonly productoCategoriaService: ProductoCategoriaService,
  ) {}

  @Post()
  @RequierePermiso('categorias.crear')
  create(@Body() createProductoCategoriaDto: CreateProductoCategoriaDto) {
    return this.productoCategoriaService.create(createProductoCategoriaDto);
  }

  @Get()
  @RequierePermiso('categorias.ver')
  findAll() {
    return this.productoCategoriaService.findAll();
  }
  @Get('activas')
  @RequierePermiso('categorias.ver')
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
  @RequierePermiso('categorias.ver')
  findOne(@Param('id') id: string) {
    return this.productoCategoriaService.findOne(id);
  }

  @Patch(':id')
  @RequierePermiso('categorias.editar')
  update(
    @Param('id') id: string,
    @Body() updateProductoCategoriaDto: UpdateProductoCategoriaDto,
  ) {
    return this.productoCategoriaService.update(id, updateProductoCategoriaDto);
  }

  @Patch(':id/toggle-activo')
  @RequierePermiso('categorias.editar')
  toggleActivo(@Param('id') id: string) {
    return this.productoCategoriaService.toggleActivo(id);
  }

  @Delete(':id')
  @RequierePermiso('categorias.eliminar')
  remove(@Param('id') id: string) {
    return this.productoCategoriaService.remove(id);
  }

  // ─── Endpoints para atributos ───
  @Post(':id/atributos')
  @RequierePermiso('categorias.editar')
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
  @RequierePermiso('categorias.ver')
  getAtributosByCategoria(@Param('id') categoriaId: string) {
    return this.productoCategoriaService.getAtributosByCategoria(categoriaId);
  }

  @Patch('atributos/:atributoId')
  @RequierePermiso('categorias.editar')
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
  @RequierePermiso('categorias.editar')
  removeAtributo(@Param('atributoId') atributoId: string) {
    return this.productoCategoriaService.removeAtributo(atributoId);
  }
}
