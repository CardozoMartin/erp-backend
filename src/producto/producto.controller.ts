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

@Controller('producto')
export class ProductoController {
  constructor(private readonly productoService: ProductoService) {}

  @Post()
  create(@Body() createProductoDto: CreateProductoDto) {
    console.log('DTO recibido en el controller:', createProductoDto);
    const producto = this.productoService.create(createProductoDto);
    return producto;
  }

  @Get()
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '30',
  ) {
    return this.productoService.findAll(Number(page), Number(limit));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productoService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProductoDto: UpdateProductoDto,
  ) {
    return this.productoService.update(id, updateProductoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productoService.remove(id);
  }

  //endpoint para sumar o restar stock de un producto o variante
  @Patch(':id/stock/ajustar')
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
  ajustarStock(
    @Param('id') id: string,
    @Body() ajustarStockDto: { cantidad: number; variante_id?: string },
  ) {
    return this.productoService.updateStockProduct(id, ajustarStockDto);
  }
}
