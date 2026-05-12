import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AtributoVariante } from '../producto/entities/atributo-variante.entity';
import { Variante } from '../producto/entities/variante.entity';
import { AtributoVarianteService } from './atributo-variante.service';
import { AtributoVarianteController } from './atributo-variante.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AtributoVariante, Variante])],
  controllers: [AtributoVarianteController],
  providers: [AtributoVarianteService],
  exports: [AtributoVarianteService],
})
export class AtributoVarianteModule {}
