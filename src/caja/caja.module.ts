import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CajaController } from './caja.controller';
import { CajaService } from './caja.service';
import { Caja } from './entities/caja.entity';
import { MovimientoCaja } from './entities/movimiento-caja.entity';
import { PagosModule } from 'src/pagos-module/pagos-module.module';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';

@Module({
  imports: [TypeOrmModule.forFeature([Caja, MovimientoCaja]), PagosModule, AuditoriaModule],
  controllers: [CajaController],
  providers: [CajaService],
  exports: [CajaService, TypeOrmModule],
})
export class CajaModule {}
