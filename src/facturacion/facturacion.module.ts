import { Module } from '@nestjs/common';
import { ClientesModule } from 'src/clientes/clientes.module';
import { ComprobantesModule } from 'src/comprobantes/comprobantes.module';
import { FacturacionController } from './facturacion.controller';
import { FacturacionService } from './facturacion.service';

@Module({
  imports: [ComprobantesModule, ClientesModule],
  controllers: [FacturacionController],
  providers: [FacturacionService],
  exports: [FacturacionService],
})
export class FacturacionModule {}
