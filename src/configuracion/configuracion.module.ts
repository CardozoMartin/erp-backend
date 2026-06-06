import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracionService } from './configuracion.service';
import { ConfiguracionController } from './configuracion.controller';
import { ConfiguracionSucursal } from './entities/configuracion.entity';
import { SucursalModule } from 'src/sucursal/sucursal.module';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';

@Module({
  imports: [TypeOrmModule.forFeature([ConfiguracionSucursal]), SucursalModule, AuditoriaModule],
  controllers: [ConfiguracionController],
  providers: [ConfiguracionService],
  exports: [ConfiguracionService, TypeOrmModule],
})
export class ConfiguracionModule {}
