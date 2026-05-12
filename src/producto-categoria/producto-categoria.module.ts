import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductoCategoria } from './entities/producto-categoria.entity';
import { ProductoCategoriaService } from './producto-categoria.service';
import { ProductoCategoriaController } from './producto-categoria.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProductoCategoria])],
  controllers: [ProductoCategoriaController],
  providers: [ProductoCategoriaService],
  exports: [ProductoCategoriaService],
})
export class ProductoCategoriaModule {}
