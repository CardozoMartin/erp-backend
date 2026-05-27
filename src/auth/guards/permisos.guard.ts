// auth/guards/permisos.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISOS_KEY } from '../decorators/requiere-permiso.decorator';

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permisosRequeridos = this.reflector.getAllAndOverride<string[]>(
      PERMISOS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!permisosRequeridos || permisosRequeridos.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    const tienePermiso = permisosRequeridos.every((p) =>
      user?.permisos?.includes(p),
    );

    if (!tienePermiso) {
      throw new ForbiddenException(
        'No tenés permisos para realizar esta acción',
      );
    }

    return true;
  }
}
