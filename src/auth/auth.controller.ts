import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
// auth/auth.controller.ts
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Publico } from './decorators/publico.decorator';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
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

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class LogoutDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

type AuthRequest = ExpressRequest & {
  user?: { id: string; sucursalId?: string | null };
};

@ApiTags('auth')
@ApiBearerAuth('JWT')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Publico()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Publico()
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('seleccionar-sucursal')
  seleccionarSucursal(
    @Request() req: AuthRequest,
    @Body() dto: SeleccionarSucursalDto,
  ) {
    return this.authService.seleccionarSucursal(req.user!.id, dto.sucursalId);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post('logout')
  logout(@Request() req: AuthRequest, @Body() dto: LogoutDto) {
    return this.authService.logout(
      req.user!.id,
      req.user!.sucursalId,
      dto.refreshToken,
    );
  }
}
