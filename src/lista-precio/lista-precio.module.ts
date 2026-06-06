import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListaPrecioService } from './lista-precio.service';
import { ListaPrecioController } from './lista-precio.controller';
import { ListaPrecio } from './entities/lista-precio.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ListaPrecio])],
  controllers: [ListaPrecioController],
  providers: [ListaPrecioService],
  exports: [ListaPrecioService, TypeOrmModule],
})
export class ListaPrecioModule {}
