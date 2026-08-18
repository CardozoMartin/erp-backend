import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';
import { CajaModule } from 'src/caja/caja.module';
import { ClientesModule } from 'src/clientes/clientes.module';
import { ComprobantesModule } from 'src/comprobantes/comprobantes.module';
import { ConfiguracionModule } from 'src/configuracion/configuracion.module';
import { ProductoModule } from 'src/producto/producto.module';
import { PagosPosModule } from 'src/pagos-pos/pagos-pos.module';
import { PedidoEnvio } from './entities/pedido-envio.entity';
import { PedidosEnvioController } from './pedidos-envio.controller';
import { PedidosEnvioService } from './pedidos-envio.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PedidoEnvio]),
    CajaModule,
    ClientesModule,
    ComprobantesModule,
    ConfiguracionModule,
    PagosPosModule,
    ProductoModule,
    AuditoriaModule,
  ],
  controllers: [PedidosEnvioController],
  providers: [PedidosEnvioService],
})
export class PedidosEnvioModule {}
