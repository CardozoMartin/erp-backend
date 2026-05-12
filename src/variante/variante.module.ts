import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Variante } from '../producto/entities/variante.entity';
import { Producto } from '../producto/entities/producto.entity';
import { VarianteService } from './variante.service';
import { VarianteController } from './variante.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Variante, Producto])],
  controllers: [VarianteController],
  providers: [VarianteService],
  exports: [VarianteService],
})
export class VarianteModule {}
