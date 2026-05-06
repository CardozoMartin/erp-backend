import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Producto } from './entities/producto.entity';
import { Variante } from './entities/variante.entity';
import { AtributoVariante } from './entities/atributo-variante.entity';
import { Stock } from './entities/stock.entity';
import { Lote } from './entities/lote.entity';
import { Imagen } from './entities/imagen.entity';
import { Oferta } from './entities/oferta.entity';
import { Categoria } from './entities/categoria.entity';
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
      Categoria,
    ]),
  ],
  controllers: [ProductoController],
  providers: [ProductoService],
  exports: [ProductoService], // exportamos por si otros módulos (ventas, pos) necesitan consultar
})
export class ProductosModule {}