import { Module } from '@nestjs/common';
import { ClientesModule } from 'src/clientes/clientes.module';
import { ComprobantesModule } from 'src/comprobantes/comprobantes.module';
import { ArcaModule } from 'src/arca/arca.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Producto } from 'src/producto/entities/producto.entity';
import { FacturacionController } from './facturacion.controller';
import { FacturacionService } from './facturacion.service';

@Module({
  imports: [
    ComprobantesModule,
    ClientesModule,
    ArcaModule,
    TypeOrmModule.forFeature([Producto]),
  ],
  controllers: [FacturacionController],
  providers: [FacturacionService],
  exports: [FacturacionService],
})
export class FacturacionModule {}
