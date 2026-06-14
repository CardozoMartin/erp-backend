// auth/auth.controller.ts
import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Publico } from './decorators/publico.decorator';
import { IsEmail, IsString, IsUUID, MinLength } from 'class-validator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class SeleccionarSucursalDto {
  @IsUUID()
  sucursalId!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Publico()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }
  @UseGuards(JwtAuthGuard)
  @Post('seleccionar-sucursal')
  seleccionarSucursal(@Request() req, @Body() dto: SeleccionarSucursalDto) {
    return this.authService.seleccionarSucursal(req.user.id, dto.sucursalId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Request() req) {
    return this.authService.logout(req.user.id, req.user.sucursalId);
  }
}
