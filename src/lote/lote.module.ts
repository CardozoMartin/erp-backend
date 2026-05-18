import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lote } from './entities/lote.entity';
import { Producto } from '../producto/entities/producto.entity';
import { Variante } from '../variante/entities/variante.entity';
import { LoteService } from './lote.service';

@Module({
  imports: [TypeOrmModule.forFeature([Lote, Producto, Variante])],
  providers: [LoteService],
  exports: [LoteService],
})
export class LoteModule {}
