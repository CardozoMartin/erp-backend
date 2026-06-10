import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CajaModule } from 'src/caja/caja.module';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';
import { ClientesModule } from 'src/clientes/clientes.module';
import { ComprobantesModule } from 'src/comprobantes/comprobantes.module';
import { ConfiguracionModule } from 'src/configuracion/configuracion.module';
import { PagosModule } from 'src/pagos-module/pagos-module.module';
import { StockMovimientosModule } from 'src/stock-movimientos/stock-movimientos.module';
import { PagoPos } from './entities/pago-pos.entity';
import { PagosPosController } from './pagos-pos.controller';
import { PagosPosService } from './pagos-pos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PagoPos]),
    AuditoriaModule,
    ComprobantesModule,
    CajaModule,
    PagosModule,
    ClientesModule,
    ConfiguracionModule,
    StockMovimientosModule,
  ],
  controllers: [PagosPosController],
  providers: [PagosPosService],
  exports: [PagosPosService, TypeOrmModule],
})
export class PagosPosModule {}
