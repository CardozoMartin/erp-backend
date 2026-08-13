import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import {
  SucursalActiva,
  SucursalesActivas,
} from 'src/sucursal/decorators/sucursales-activas.decorator';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { ProductoService } from './producto.service';
import { ProductoImportacionService } from './producto-importacion.service';

@ApiTags('productos')
@ApiBearerAuth('JWT')
@Controller('producto')
export class ProductoController {
  constructor(
    private readonly productoService: ProductoService,
    private readonly importacionService: ProductoImportacionService,
  ) {}

  private puedeVerCosto(permisos: string[] = []) {
    return permisos.includes('productos.ver_costos');
  }

  private puedeVerMargen(permisos: string[] = []) {
    return permisos.includes('productos.ver_margenes');
  }

  private filtrarDatosFinancieros<T>(payload: T, permisos: string[] = []): T {
    const puedeVerCosto = this.puedeVerCosto(permisos);
    const puedeVerMargen = this.puedeVerMargen(permisos);
    const filtrarProducto = (producto: any) => {
      if (!producto) return producto;
      const limpio = { ...producto };
      if (!puedeVerCosto) delete limpio.precio_costo;
      if (!puedeVerMargen) delete limpio.margen_ganancia;
      return limpio;
    };

    if (Array.isArray(payload)) {
      return payload.map((producto) => filtrarProducto(producto)) as T;
    }

    return filtrarProducto(payload) as T;
  }

  private filtrarDtoFinanciero<T extends Record<string, any>>(
    dto: T,
    permisos: string[] = [],
  ): T {
    const limpio = { ...dto };
    if (!this.puedeVerCosto(permisos)) delete limpio.precio_costo;
    if (!this.puedeVerMargen(permisos)) delete limpio.margen_ganancia;
    return limpio;
  }

  @Post()
  @RequierePermiso('productos.crear')
  create(
    @Body() createProductoDto: CreateProductoDto,
    @SucursalActiva() sucursalActivaId: string,
    @Request() req,
  ) {
    return this.productoService
      .create(
        this.filtrarDtoFinanciero(createProductoDto, req.user?.permisos),
        sucursalActivaId,
        req.user?.id,
      )
      .then((producto) =>
        this.filtrarDatosFinancieros(producto, req.user?.permisos),
      );
  }

  @Get()
  @RequierePermiso('productos.ver')
  findAll(
    @SucursalesActivas() sucursalIds: string[],
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '30',
    @Request() req,
  ) {
    return this.productoService
      .findAll(sucursalIds)
      .then((productos) =>
        this.filtrarDatosFinancieros(productos, req.user?.permisos),
      );
  }

  @Get(':id')
  @RequierePermiso('productos.ver')
  findOne(
    @Param('id') id: string,
    @SucursalesActivas() sucursalIds: string[],
    @Request() req,
  ) {
    return this.productoService
      .findOne(id, sucursalIds)
      .then((producto) =>
        this.filtrarDatosFinancieros(producto, req.user?.permisos),
      );
  }

  @Patch(':id')
  @RequierePermiso('productos.editar')
  update(
    @Param('id') id: string,
    @Body() updateProductoDto: UpdateProductoDto,
    @SucursalActiva() sucursalActivaId: string,
    @Request() req,
  ) {
    return this.productoService
      .update(
        id,
        this.filtrarDtoFinanciero(updateProductoDto, req.user?.permisos),
        req.user?.id,
        sucursalActivaId,
      )
      .then((producto) =>
        this.filtrarDatosFinancieros(producto, req.user?.permisos),
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
    return this.productoService.adjustStockProduct(
      id,
      {
        ...ajustarStockDto,
        sucursal_id: sucursalActivaId,
      },
      req.user?.id,
    );
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
    return this.productoService.updateStockProduct(
      id,
      {
        ...ajustarStockDto,
        sucursal_id: sucursalActivaId,
      },
      req.user?.id,
    );
  }

  // ── Importación desde Excel ──────────────────────────────────────────────────

  @Get('importar/plantilla')
  @RequierePermiso('productos.crear')
  async descargarPlantilla(@Res() res: Response) {
    const buffer = await this.importacionService.generarPlantilla();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-importacion-productos.xlsx"',
    });
    res.send(buffer);
  }

  @Post('importar')
  @RequierePermiso('productos.crear')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  importarDesdeExcel(
    @UploadedFile() archivo: Express.Multer.File,
    @SucursalActiva() sucursalId: string,
    @Request() req,
  ) {
    if (!archivo) throw new Error('Se requiere un archivo Excel');
    return this.importacionService.importar(archivo.buffer, sucursalId, req.user?.id);
  }
}
