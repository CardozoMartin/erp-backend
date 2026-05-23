import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Variante } from './entities/variante.entity';
import { Producto } from '../producto/entities/producto.entity';
import { VarianteService } from './variante.service';

@Module({
  imports: [TypeOrmModule.forFeature([Variante, Producto])],
  providers: [VarianteService],
  exports: [VarianteService],
})
export class VarianteModule {}
