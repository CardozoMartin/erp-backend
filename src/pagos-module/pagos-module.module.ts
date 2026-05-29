// pagos-module.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedioPago } from './entities/medio-pago.entity';
import { PagosModuleController } from './pagos-module.controller';
import { PagosModuleService } from './pagos-module.service';

@Module({
  imports: [TypeOrmModule.forFeature([MedioPago])],
  controllers: [PagosModuleController],
  providers: [PagosModuleService],
  exports: [PagosModuleService, TypeOrmModule],
})
export class PagosModule {}
