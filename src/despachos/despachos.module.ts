import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';
import { ComprobantesModule } from 'src/comprobantes/comprobantes.module';
import { ConfiguracionModule } from 'src/configuracion/configuracion.module';
import { StockMovimientosModule } from 'src/stock-movimientos/stock-movimientos.module';
import { DespachosController } from './despachos.controller';
import { DespachosService } from './despachos.service';
import { DespachoItem } from './entities/despacho-item.entity';
import { Despacho } from './entities/despacho.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Despacho, DespachoItem]),
    ComprobantesModule,
    ConfiguracionModule,
    StockMovimientosModule,
    AuditoriaModule,
  ],
  controllers: [DespachosController],
  providers: [DespachosService],
  exports: [DespachosService, TypeOrmModule],
})
export class DespachosModule {}
