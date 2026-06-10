import { Module } from '@nestjs/common';
import { CajaModule } from 'src/caja/caja.module';
import { ClientesModule } from 'src/clientes/clientes.module';
import { ComprobantesModule } from 'src/comprobantes/comprobantes.module';
import { StockMovimientosModule } from 'src/stock-movimientos/stock-movimientos.module';
import { NotasCreditoController } from './notas-credito.controller';
import { NotasCreditoService } from './notas-credito.service';

@Module({
  imports: [ComprobantesModule, StockMovimientosModule, ClientesModule, CajaModule],
  controllers: [NotasCreditoController],
  providers: [NotasCreditoService],
  exports: [NotasCreditoService],
})
export class NotasCreditoModule {}
