import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';
import { Producto } from 'src/producto/entities/producto.entity';
import { Stock } from 'src/stock/entities/stock.entity';
import { StockMovimiento } from './entities/stock-movimiento.entity';
import { StockMovimientosController } from './stock-movimientos.controller';
import { StockMovimientosService } from './stock-movimientos.service';

@Module({
  imports: [AuditoriaModule, TypeOrmModule.forFeature([StockMovimiento, Stock, Producto])],
  controllers: [StockMovimientosController],
  providers: [StockMovimientosService],
  exports: [StockMovimientosService, TypeOrmModule],
})
export class StockMovimientosModule {}
