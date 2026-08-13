import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Oferta } from './entities/oferta.entity';
import { Producto } from '../producto/entities/producto.entity';
import { Variante } from '../variante/entities/variante.entity';
import { OfertaService } from './oferta.service';
import { OfertaController } from './oferta.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Oferta, Producto, Variante])],
  controllers: [OfertaController],
  providers: [OfertaService],
  exports: [OfertaService],
})
export class OfertaModule {}
