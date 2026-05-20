import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductoPrecio } from './entities/producto_precio.entity';
import { ProductoPreciosService } from './producto_precios.service';
import { ProductoPreciosController } from './producto_precios.controller';
import { MarcaProducto } from 'src/marca_productos/entities/marca_producto.entity';
import { Producto } from 'src/producto/entities/producto.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductoPrecio, MarcaProducto, Producto])],
  providers: [ProductoPreciosService],
  controllers: [ProductoPreciosController],
  exports: [ProductoPreciosService], // ← esto es clave para usarlo en ProductoModule
})
export class ProductoPreciosModule {}
