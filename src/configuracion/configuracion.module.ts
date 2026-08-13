import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from 'src/shared/shared.module';
import { ConfiguracionService } from './configuracion.service';
import { ConfiguracionEmailService } from './configuracion-email.service';
import { ConfiguracionServiciosService } from './configuracion-servicios.service';
import { ConfiguracionController } from './configuracion.controller';
import { EmailTemplateService } from 'src/email/email-template.service';
import { ConfiguracionEmailSucursal } from './entities/configuracion-email.entity';
import { ConfiguracionSucursal } from './entities/configuracion.entity';
import { ConfiguracionCloudinarySucursal } from 'src/cloudinary/entities/configuracion-cloudinary.entity';
import { MpConfig } from 'src/mercadopago/entities/mp-config.entity';
import { ArcaConfig } from 'src/arca/entities/arca-config.entity';
import { SucursalModule } from 'src/sucursal/sucursal.module';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';

@Module({
  imports: [
    SharedModule,
    TypeOrmModule.forFeature([
      ConfiguracionSucursal,
      ConfiguracionEmailSucursal,
      ConfiguracionCloudinarySucursal,
      MpConfig,
      ArcaConfig,
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
    EmailTemplateService,
  ],
  exports: [
    ConfiguracionService,
    ConfiguracionEmailService,
    ConfiguracionServiciosService,
    EmailTemplateService,
    TypeOrmModule,
  ],
})
export class ConfiguracionModule {}
