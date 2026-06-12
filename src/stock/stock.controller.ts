import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateStockDto, AjustarStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post()
  @RequierePermiso('stock.editar')
  create(@Body() createStockDto: CreateStockDto) {
    return this.stockService.create(createStockDto);
  }

  @Get()
  @RequierePermiso('stock.ver')
  findAll() {
    return this.stockService.findAll();
  }

  // Esta ruta debe ir ANTES de :id para que no la capture como UUID
  @Get('producto/:productoId')
  @RequierePermiso('stock.ver')
  findByProducto(@Param('productoId') productoId: string) {
    return this.stockService.findByProducto(productoId);
  }

  @Get(':id')
  @RequierePermiso('stock.ver')
  findOne(@Param('id') id: string) {
    return this.stockService.findOneOrFail(id);
  }

  @Patch(':id')
  @RequierePermiso('stock.editar')
  update(@Param('id') id: string, @Body() updateStockDto: UpdateStockDto) {
    return this.stockService.update(id, updateStockDto);
  }

  @Patch(':id/ajustar')
  @RequierePermiso('stock.ajuste')
  ajustar(@Param('id') id: string, @Body() ajustarDto: AjustarStockDto) {
    return this.stockService.ajustar(id, ajustarDto);
  }

  @Delete(':id')
  @RequierePermiso('stock.editar')
  remove(@Param('id') id: string) {
    return this.stockService.remove(id);
  }
}
