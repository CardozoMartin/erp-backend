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
import { ProductoService } from './producto.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';

@Controller('producto')
export class ProductoController {
  constructor(private readonly productoService: ProductoService) {}

  @Post()
  @RequierePermiso('productos.crear')
  create(@Body() createProductoDto: CreateProductoDto) {
    console.log('DTO recibido en el controller:', createProductoDto);
    const producto = this.productoService.create(createProductoDto);
    return producto;
  }

  @Get()
  @RequierePermiso('productos.ver')
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '30',
  ) {
    return this.productoService.findAll(Number(page), Number(limit));
  }

  @Get(':id')
  @RequierePermiso('productos.ver')
  findOne(@Param('id') id: string) {
    return this.productoService.findOne(id);
  }

  @Patch(':id')
  @RequierePermiso('productos.editar')
  update(
    @Param('id') id: string,
    @Body() updateProductoDto: UpdateProductoDto,
  ) {
    return this.productoService.update(id, updateProductoDto);
  }

  @Delete(':id')
  @RequierePermiso('productos.editar')
  remove(@Param('id') id: string) {
    return this.productoService.remove(id);
  }

  //endpoint para sumar o restar stock de un producto o variante
  @Patch(':id/stock/ajustar')
  @RequierePermiso('productos.ajustar-stock')
  ajustarMovimientoStock(
    @Param('id') id: string,
    @Body()
    ajustarStockDto: {
      cantidad: number | string;
      operacion: 'AUMENTAR' | 'RESTAR';
      sucursal_id?: string | null;
      variante_id?: string | null;
    },
  ) {
    return this.productoService.adjustStockProduct(id, ajustarStockDto);
  }

  //endpoint para actualizar solamente el stock de un producto o variantes
  @Patch(':id/stock')
  @RequierePermiso('productos.editar')
  ajustarStock(
    @Param('id') id: string,
    @Body() ajustarStockDto: { cantidad: number; variante_id?: string },
  ) {
    return this.productoService.updateStockProduct(id, ajustarStockDto);
  }
}
