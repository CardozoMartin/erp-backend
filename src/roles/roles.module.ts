import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { Role } from './entities/role.entity';
import { PermisosModule } from 'src/permisos/permisos.module';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';

@Module({
  imports: [TypeOrmModule.forFeature([Role]), PermisosModule, AuditoriaModule],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
