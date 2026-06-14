// auth/guards/permisos.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISOS_ANY_KEY,
  PERMISOS_KEY,
} from '../decorators/requiere-permiso.decorator';

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permisosRequeridos = this.reflector.getAllAndOverride<string[]>(
      PERMISOS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const permisosAlternativos = this.reflector.getAllAndOverride<string[]>(
      PERMISOS_ANY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      (!permisosRequeridos || permisosRequeridos.length === 0) &&
      (!permisosAlternativos || permisosAlternativos.length === 0)
    ) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const permisosUsuario: string[] = user?.permisos ?? [];
    const tienePermisosRequeridos = (permisosRequeridos ?? []).every((p) =>
      permisosUsuario.includes(p),
    );
    const tienePermisoAlternativo =
      !permisosAlternativos?.length ||
      permisosAlternativos.some((p) => permisosUsuario.includes(p));

    if (!tienePermisosRequeridos || !tienePermisoAlternativo) {
      throw new ForbiddenException(
        'No tenes permisos para realizar esta accion',
      );
    }

    return true;
  }
}
