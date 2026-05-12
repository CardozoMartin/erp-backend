import { Module } from '@nestjs/common';
import { StocksProductsService } from './stocks-products.service';
import { StocksProductsController } from './stocks-products.controller';

@Module({
  controllers: [StocksProductsController],
  providers: [StocksProductsService],
})
export class StocksProductsModule {}
