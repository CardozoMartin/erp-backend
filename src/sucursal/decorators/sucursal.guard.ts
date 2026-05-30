import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

// guards/sucursal.guard.ts
@Injectable()
export class SucursalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // ya validado por JwtAuthGuard

    if (!user?.sucursalId) {
      throw new ForbiddenException(
        'Debés seleccionar una sucursal antes de continuar',
      );
    }

    return true;
  }
}
