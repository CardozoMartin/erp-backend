import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracionModule } from 'src/configuracion/configuracion.module';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';
import { ListaPrecioModule } from 'src/lista-precio/lista-precio.module';
import { ProductoSucursal } from 'src/producto/entities/producto-sucursal-entity';
import { Producto } from 'src/producto/entities/producto.entity';
import { Stock } from 'src/stock/entities/stock.entity';
import { ComprobantesController } from './comprobantes.controller';
import { ComprobantesService } from './comprobantes.service';
import { ComprobanteItem } from './entities/comprobante-item.entity';
import { Comprobante } from './entities/comprobante.entity';
import { NumeradorComprobante } from './entities/numerador-comprobante.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Comprobante,
      ComprobanteItem,
      NumeradorComprobante,
      Producto,
      Stock,
      ProductoSucursal,
    ]),
    AuditoriaModule,
    ConfiguracionModule,
    ListaPrecioModule,
  ],
  controllers: [ComprobantesController],
  providers: [ComprobantesService],
  exports: [ComprobantesService, TypeOrmModule],
})
export class ComprobantesModule {}
