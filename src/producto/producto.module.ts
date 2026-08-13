import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';
import { ProductoPrecio } from 'src/producto_precios/entities/producto_precio.entity';
import { ProductoPreciosModule } from 'src/producto_precios/producto_precios.module';
import { Sucursal } from 'src/sucursal/entities/sucursal.entity';
import { SucursalModule } from 'src/sucursal/sucursal.module';
import { AtributoProducto } from '../atributo-producto/entities/atributo-producto.entity';
import { AtributoVariante } from '../atributo-variante/entities/atributo-variante.entity';
import { Imagen } from '../imagen/entities/imagen.entity';
import { Lote } from '../lote/entities/lote.entity';
import { MarcaProducto } from '../marca_productos/entities/marca_producto.entity';
import { Oferta } from '../oferta/entities/oferta.entity';
import { ProductoCategoria } from '../producto-categoria/entities/producto-categoria.entity';
import { Stock } from '../stock/entities/stock.entity';
import { Variante } from '../variante/entities/variante.entity';
import { ProductoSucursal } from './entities/producto-sucursal-entity';
import { Producto } from './entities/producto.entity';
import { ProductoController } from './producto.controller';
import { ProductoService } from './producto.service';
import { ProductoImportacionService } from './producto-importacion.service';

@Module({
  imports: [
    AuditoriaModule,
    ProductoPreciosModule,
    SucursalModule,
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
      MarcaProducto,
      ProductoSucursal,
      Sucursal,
    ]),
  ],
  controllers: [ProductoController],
  providers: [ProductoService, ProductoImportacionService],
  exports: [ProductoService], // exportamos por si otros módulos (ventas, pos) necesitan consultar
})
export class ProductoModule {}
