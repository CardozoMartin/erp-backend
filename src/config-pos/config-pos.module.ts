// config-pos/config-pos.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigPosSucursal } from './entities/config-pos-sucursal.entity';
import { ConfigPosController } from './config-pos.controller';
import { ConfigPosService } from './config-pos.service';
import { SucursalModule } from 'src/sucursal/sucursal.module';

@Module({
  imports: [TypeOrmModule.forFeature([ConfigPosSucursal]), SucursalModule],
  controllers: [ConfigPosController],
  providers: [ConfigPosService],
  exports: [ConfigPosService], // ← lo van a necesitar ventas y caja
})
export class ConfigPosModule {}
