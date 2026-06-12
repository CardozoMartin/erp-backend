import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracionService } from './configuracion.service';
import { ConfiguracionEmailService } from './configuracion-email.service';
import { ConfiguracionServiciosService } from './configuracion-servicios.service';
import { ConfiguracionController } from './configuracion.controller';
import { ConfiguracionEmailSucursal } from './entities/configuracion-email.entity';
import { ConfiguracionSucursal } from './entities/configuracion.entity';
import { ConfiguracionCloudinarySucursal } from 'src/cloudinary/entities/configuracion-cloudinary.entity';
import { MpConfig } from 'src/mercadopago/entities/mp-config.entity';
import { SucursalModule } from 'src/sucursal/sucursal.module';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConfiguracionSucursal,
      ConfiguracionEmailSucursal,
      ConfiguracionCloudinarySucursal,
      MpConfig,
    ]),
    SucursalModule,
    AuditoriaModule,
    CloudinaryModule,
  ],
  controllers: [ConfiguracionController],
  providers: [
    ConfiguracionService,
    ConfiguracionEmailService,
    ConfiguracionServiciosService,
  ],
  exports: [
    ConfiguracionService,
    ConfiguracionEmailService,
    ConfiguracionServiciosService,
    TypeOrmModule,
  ],
})
export class ConfiguracionModule {}
