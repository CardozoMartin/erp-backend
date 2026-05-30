// auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { EmpleadosModule } from 'src/empleados/empleados.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Empleado } from 'src/empleados/entities/empleado.entity';
import { EmpleadoSucursal } from 'src/empleados/entities/empleado-sucursal.entity';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([Empleado, EmpleadoSucursal]),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev_secret_cambiar_en_prod',
      signOptions: { expiresIn: '8h' },
    }),
    EmpleadosModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
