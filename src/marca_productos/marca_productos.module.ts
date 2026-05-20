import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarcaProductosService } from './marca_productos.service';
import { MarcaProductosController } from './marca_productos.controller';
import { MarcaProducto } from './entities/marca_producto.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MarcaProducto])],
  controllers: [MarcaProductosController],
  providers: [MarcaProductosService],
  exports: [MarcaProductosService],
})
export class MarcaProductosModule {}
