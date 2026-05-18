import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AtributoVariante } from '../atributo-variante/entities/atributo-variante.entity';
import { ProductoCategoria } from '../producto-categoria/entities/producto-categoria.entity';
import { Imagen } from '../imagen/entities/imagen.entity';
import { Lote } from '../lote/entities/lote.entity';
import { Oferta } from '../oferta/entities/oferta.entity';
import { Producto } from './entities/producto.entity';
import { Stock } from '../stock/entities/stock.entity';
import { Variante } from '../variante/entities/variante.entity';
import { ProductoController } from './producto.controller';
import { ProductoService } from './producto.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Producto,
      Variante,
      AtributoVariante,
      Stock,
      Lote,
      Imagen,
      Oferta,
      ProductoCategoria,
    ]),
  ],
  controllers: [ProductoController],
  providers: [ProductoService],
  exports: [ProductoService], // exportamos por si otros módulos (ventas, pos) necesitan consultar
})
export class ProductoModule {}
