import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lote } from '../producto/entities/lote.entity';
import { Producto } from '../producto/entities/producto.entity';
import { Variante } from '../producto/entities/variante.entity';
import { LoteService } from './lote.service';
import { LoteController } from './lote.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Lote, Producto, Variante])],
  controllers: [LoteController],
  providers: [LoteService],
  exports: [LoteService],
})
export class LoteModule {}
