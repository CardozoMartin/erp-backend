import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { StocksProductsService } from './stocks-products.service';
import { CreateStocksProductDto } from './dto/create-stocks-product.dto';
import { UpdateStocksProductDto } from './dto/update-stocks-product.dto';

@Controller('stocks-products')
export class StocksProductsController {
  constructor(private readonly stocksProductsService: StocksProductsService) {}

  @Post()
  create(@Body() createStocksProductDto: CreateStocksProductDto) {
    return this.stocksProductsService.create(createStocksProductDto);
  }

  @Get()
  findAll() {
    return this.stocksProductsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stocksProductsService.findOneOrFail(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStocksProductDto: UpdateStocksProductDto) {
    return this.stocksProductsService.update(id, updateStocksProductDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.stocksProductsService.remove(id);
  }
}
