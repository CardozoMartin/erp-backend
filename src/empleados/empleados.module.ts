import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';
import { EmpleadosService } from './empleados.service';
import { EmpleadosController } from './empleados.controller';
import { Empleado } from './entities/empleado.entity';
import { EmpleadoRol } from './entities/empleado-rol.entity';
import { RolesModule } from 'src/roles/roles.module';
import { EmpleadoSucursal } from './entities/empleado-sucursal.entity';
import { EmpleadoPermiso } from './entities/empleado-permiso.entity';
import { SucursalModule } from 'src/sucursal/sucursal.module';
import { EmpleadoSucursalesService } from './empleado-sucursales.service';
import { Comprobante } from 'src/comprobantes/entities/comprobante.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Empleado,
      EmpleadoRol,
      EmpleadoSucursal,
      EmpleadoPermiso,
      Comprobante,
    ]),
    RolesModule,
    SucursalModule,
    AuditoriaModule,
  ],
  controllers: [EmpleadosController],
  providers: [EmpleadosService, EmpleadoSucursalesService],
  exports: [EmpleadosService, EmpleadoSucursalesService, TypeOrmModule],
})
export class EmpleadosModule {}
