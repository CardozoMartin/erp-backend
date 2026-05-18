import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateStockDto, AjustarStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post()
  create(@Body() createStockDto: CreateStockDto) {
    return this.stockService.create(createStockDto);
  }

  @Get()
  findAll() {
    return this.stockService.findAll();
  }

  // Esta ruta debe ir ANTES de :id para que no la capture como UUID
  @Get('producto/:productoId')
  findByProducto(@Param('productoId') productoId: string) {
    return this.stockService.findByProducto(productoId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stockService.findOneOrFail(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStockDto: UpdateStockDto) {
    return this.stockService.update(id, updateStockDto);
  }

  @Patch(':id/ajustar')
  ajustar(@Param('id') id: string, @Body() ajustarDto: AjustarStockDto) {
    return this.stockService.ajustar(id, ajustarDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.stockService.remove(id);
  }
}
