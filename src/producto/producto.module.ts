import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AtributoVariante } from '../atributo-variante/entities/atributo-variante.entity';
import { AtributoProducto } from '../atributo-producto/entities/atributo-producto.entity';
import { ProductoCategoria } from '../producto-categoria/entities/producto-categoria.entity';
import { Imagen } from '../imagen/entities/imagen.entity';
import { Lote } from '../lote/entities/lote.entity';
import { Oferta } from '../oferta/entities/oferta.entity';
import { Producto } from './entities/producto.entity';
import { Stock } from '../stock/entities/stock.entity';
import { Variante } from '../variante/entities/variante.entity';
import { ProductoController } from './producto.controller';
import { ProductoService } from './producto.service';
import { ProductoPrecio } from 'src/producto_precios/entities/producto_precio.entity';
import { ProductoPreciosModule } from 'src/producto_precios/producto_precios.module';

@Module({
  imports: [
    ProductoPreciosModule,
    TypeOrmModule.forFeature([
      Producto,
      Variante,
      AtributoVariante,
      AtributoProducto,
      Stock,
      Lote,
      Imagen,
      Oferta,
      ProductoCategoria,
      ProductoPrecio,
    ]),
  ],
  controllers: [ProductoController],
  providers: [ProductoService],
  exports: [ProductoService], // exportamos por si otros módulos (ventas, pos) necesitan consultar
})
export class ProductoModule {}
