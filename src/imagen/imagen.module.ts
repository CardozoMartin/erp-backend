import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Imagen } from '../producto/entities/imagen.entity';
import { Producto } from '../producto/entities/producto.entity';
import { Variante } from '../producto/entities/variante.entity';
import { ImagenService } from './imagen.service';
import { ImagenController } from './imagen.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Imagen, Producto, Variante])],
  controllers: [ImagenController],
  providers: [ImagenService],
  exports: [ImagenService],
})
export class ImagenModule {}
