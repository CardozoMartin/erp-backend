import { Module } from '@nestjs/common';
import { MarcaProductosService } from './marca_productos.service';
import { MarcaProductosController } from './marca_productos.controller';

@Module({
  controllers: [MarcaProductosController],
  providers: [MarcaProductosService],
})
export class MarcaProductosModule {}
