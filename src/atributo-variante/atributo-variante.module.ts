import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AtributoVariante } from './entities/atributo-variante.entity';
import { Variante } from '../variante/entities/variante.entity';
import { AtributoVarianteService } from './atributo-variante.service';

@Module({
  imports: [TypeOrmModule.forFeature([AtributoVariante, Variante])],
  providers: [AtributoVarianteService],
  exports: [AtributoVarianteService],
})
export class AtributoVarianteModule {}
