import { Body, Controller, Get, Param, Post, Request } from '@nestjs/common';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';
import { AjusteManualStockDto } from './dto/create-stock-movimiento.dto';
import { StockMovimientosService } from './stock-movimientos.service';

@Controller('stock-movimientos')
export class StockMovimientosController {
  constructor(private readonly service: StockMovimientosService) {}

  @Post('ajuste')
  ajusteManual(
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: AjusteManualStockDto,
  ) {
    return this.service.ajusteManual(sucursalId, req.user.id, dto);
  }

  @Get()
  findAll(@SucursalActiva() sucursalId: string) {
    return this.service.findAll(sucursalId);
  }

  @Get('producto/:productoId')
  findByProducto(
    @SucursalActiva() sucursalId: string,
    @Param('productoId') productoId: string,
  ) {
    return this.service.findByProducto(sucursalId, productoId);
  }
}
