import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { ProductoPreciosService } from './producto_precios.service';
import { CreateProductoPrecioDto } from './dto/create-producto_precio.dto';
import { UpdateProductoPrecioDto } from './dto/update-producto_precio.dto';

@Controller('producto-precios')
export class ProductoPreciosController {
  constructor(private readonly productoPreciosService: ProductoPreciosService) {}

  @Post()
  @RequierePermiso('precios.crear')
  create(@Body() createProductoPrecioDto: CreateProductoPrecioDto) {
    return this.productoPreciosService.create(createProductoPrecioDto);
  }

  // Obtener todos los precios de un producto específico
  @Get('producto/:productoId')
  @RequierePermiso('precios.ver')
  findByProducto(@Param('productoId') productoId: string) {
    return this.productoPreciosService.findByProducto(productoId);
  }

  // Obtener el precio vigente de un producto (opcionalmente filtrado por sucursal)
  @Get('vigente/:productoId')
  @RequierePermiso('precios.ver')
  getPrecioVigente(
    @Param('productoId') productoId: string,
    @Query('sucursalId') sucursalId?: string,
  ) {
    return this.productoPreciosService.getPrecioVigente(productoId, sucursalId);
  }

  @Patch(':id')
  @RequierePermiso('precios.editar')
  update(
    @Param('id') id: string,
    @Body() updateProductoPrecioDto: UpdateProductoPrecioDto,
  ) {
    return this.productoPreciosService.update(id, updateProductoPrecioDto);
  }

  @Delete(':id')
  @RequierePermiso('precios.eliminar')
  remove(@Param('id') id: string) {
    return this.productoPreciosService.remove(id);
  }
}
