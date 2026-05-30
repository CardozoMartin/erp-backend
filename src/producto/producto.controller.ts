// producto/producto.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import {
  SucursalActiva,
  SucursalesActivas,
} from 'src/sucursal/decorators/sucursales-activas.decorator';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { ProductoService } from './producto.service';

@Controller('producto')
export class ProductoController {
  constructor(private readonly productoService: ProductoService) {}

  @Post()
  @RequierePermiso('productos.crear')
  create(
    @Body() createProductoDto: CreateProductoDto,
    @SucursalActiva() sucursalActivaId: string,
  ) {
    return this.productoService.create(createProductoDto, sucursalActivaId);
  }

  @Get()
  @RequierePermiso('productos.ver')
  findAll(
    @SucursalesActivas() sucursalIds: string[],
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '30',
  ) {
    return this.productoService.findAll(sucursalIds);
  }

  @Get(':id')
  @RequierePermiso('productos.ver')
  findOne(@Param('id') id: string, @SucursalesActivas() sucursalIds: string[]) {
    return this.productoService.findOne(id, sucursalIds);
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

  // Activar/desactivar producto en una sucursal
  @Patch(':id/sucursal/:sucursalId/toggle')
  @RequierePermiso('productos.editar')
  toggleSucursal(
    @Param('id') id: string,
    @Param('sucursalId') sucursalId: string,
  ) {
    return this.productoService.toggleSucursal(id, sucursalId);
  }

  // Consultar stock en otra sucursal
  @Get(':id/stock/sucursal/:sucursalId')
  @RequierePermiso('stock.ver')
  stockEnSucursal(
    @Param('id') id: string,
    @Param('sucursalId') sucursalId: string,
    @SucursalActiva() sucursalActivaId: string,
  ) {
    return this.productoService.stockEnSucursal(
      id,
      sucursalId,
      sucursalActivaId,
    );
  }

  @Patch(':id/stock/ajustar')
  @RequierePermiso('productos.ajustar-stock')
  ajustarMovimientoStock(
    @Param('id') id: string,
    @SucursalActiva() sucursalActivaId: string,
    @Body()
    ajustarStockDto: {
      cantidad: number | string;
      operacion: 'AUMENTAR' | 'RESTAR';
      sucursal_id?: string | null;
      variante_id?: string | null;
    },
  ) {
    return this.productoService.adjustStockProduct(id, {
      ...ajustarStockDto,
      sucursal_id: sucursalActivaId,
    });
  }

  @Patch(':id/stock')
  @RequierePermiso('productos.editar')
  ajustarStock(
    @Param('id') id: string,
    @SucursalActiva() sucursalActivaId: string,
    @Body()
    ajustarStockDto: {
      cantidad?: number;
      cantidad_minima?: number;
      sucursal_id?: string | null;
      variante_id?: string;
    },
  ) {
    return this.productoService.updateStockProduct(id, {
      ...ajustarStockDto,
      sucursal_id: sucursalActivaId,
    });
  }
}
