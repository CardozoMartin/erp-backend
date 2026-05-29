// auth/decorators/requiere-permiso.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const PERMISOS_KEY = 'permisos';
export const RequierePermiso = (...permisos: string[]) =>
  SetMetadata(PERMISOS_KEY, permisos);
