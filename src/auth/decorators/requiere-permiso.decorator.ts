// auth/decorators/requiere-permiso.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const PERMISOS_KEY = 'permisos';
export const PERMISOS_ANY_KEY = 'permisos_any';
export const RequierePermiso = (...permisos: string[]) =>
  SetMetadata(PERMISOS_KEY, permisos);
export const RequiereAlgunoPermiso = (...permisos: string[]) =>
  SetMetadata(PERMISOS_ANY_KEY, permisos);
