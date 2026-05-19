import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriaAtributoDef } from './entities/categoria-atributoDef';
import { ProductoCategoria } from './entities/producto-categoria.entity';
import { ProductoCategoriaController } from './producto-categoria.controller';
import { ProductoCategoriaService } from './producto-categoria.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductoCategoria, CategoriaAtributoDef]),
  ],
  controllers: [ProductoCategoriaController],
  providers: [ProductoCategoriaService],
  exports: [ProductoCategoriaService],
})
export class ProductoCategoriaModule {}
