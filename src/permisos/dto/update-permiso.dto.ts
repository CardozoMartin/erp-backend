import { PartialType } from '@nestjs/mapped-types';
import { CrearPermisoDto } from './create-permiso.dto';

export class UpdatePermisoDto extends PartialType(CrearPermisoDto) {}
