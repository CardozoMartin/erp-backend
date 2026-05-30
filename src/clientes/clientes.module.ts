import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { Cliente } from './entities/cliente.entity';
import { CuentaCorriente } from './entities/cuenta-corriente.entity';
import { MovimientoCuentaCorriente } from './entities/movimiento-cuenta-corriente.entity';
import { PlanPago } from './entities/plan-pago.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cliente,
      CuentaCorriente,
      MovimientoCuentaCorriente,
      PlanPago,
    ]),
  ],
  controllers: [ClientesController],
  providers: [ClientesService],
  exports: [ClientesService, TypeOrmModule],
})
export class ClientesModule {}
