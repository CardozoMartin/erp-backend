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
  Request,
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
    @Request() req,
  ) {
    return this.productoService.create(
      createProductoDto,
      sucursalActivaId,
      req.user?.id,
    );
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
    @SucursalActiva() sucursalActivaId: string,
    @Request() req,
  ) {
    return this.productoService.update(
      id,
      updateProductoDto,
      req.user?.id,
      sucursalActivaId,
    );
  }

  @Delete(':id')
  @RequierePermiso('productos.editar')
  remove(
    @Param('id') id: string,
    @SucursalActiva() sucursalActivaId: string,
    @Request() req,
  ) {
    return this.productoService.remove(id, req.user?.id, sucursalActivaId);
  }

  // Activar/desactivar producto en una sucursal
  @Patch(':id/sucursal/:sucursalId/toggle')
  @RequierePermiso('productos.editar')
  toggleSucursal(
    @Param('id') id: string,
    @Param('sucursalId') sucursalId: string,
    @Request() req,
  ) {
    return this.productoService.toggleSucursal(id, sucursalId, req.user?.id);
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
    @Request() req,
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
    }, req.user?.id);
  }

  @Patch(':id/stock')
  @RequierePermiso('productos.editar')
  ajustarStock(
    @Param('id') id: string,
    @SucursalActiva() sucursalActivaId: string,
    @Request() req,
    @Body()
    ajustarStockDto: {
      cantidad?: number;
      cantidad_minima?: number;
      sucursal_id?: string | null;
      variante_id?: string;
      deposito?: string | null;
      pasillo?: string | null;
      estante?: string | null;
      sector?: string | null;
      codigo_ubicacion?: string | null;
      ubicacion_referencia?: string | null;
    },
  ) {
    return this.productoService.updateStockProduct(id, {
      ...ajustarStockDto,
      sucursal_id: sucursalActivaId,
    }, req.user?.id);
  }
}
