import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Imagen } from './entities/imagen.entity';
import { Producto } from '../producto/entities/producto.entity';
import { Variante } from '../variante/entities/variante.entity';
import { ImagenService } from './imagen.service';
import { ImagenController } from './imagen.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Imagen, Producto, Variante]),
    CloudinaryModule, // ← provee CloudinaryService
  ],
  controllers: [ImagenController],
  providers: [ImagenService],
  exports: [ImagenService],
})
export class ImagenModule {}
