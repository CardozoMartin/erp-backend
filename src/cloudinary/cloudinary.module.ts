import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';
import { CloudinaryService } from './cloudinary.service';
import { ConfiguracionCloudinarySucursal } from './entities/configuracion-cloudinary.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ConfiguracionCloudinarySucursal]),
    AuditoriaModule,
  ],
  providers: [CloudinaryService],
  exports: [CloudinaryService, TypeOrmModule],
})
export class CloudinaryModule {}
