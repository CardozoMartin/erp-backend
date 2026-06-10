import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermisosService } from './permisos.service';
import { PermisosController } from './permisos.controller';
import { PermisosSeedService } from './permisos-seed.service';
import { Permiso } from './entities/permiso.entity';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';

@Module({
  imports: [TypeOrmModule.forFeature([Permiso]), AuditoriaModule],
  controllers: [PermisosController],
  providers: [PermisosService, PermisosSeedService],
  exports: [PermisosService, PermisosSeedService],
})
export class PermisosModule {}
