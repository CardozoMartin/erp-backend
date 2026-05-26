import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CrearRoleDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsString()
  @IsNotEmpty()
  rutaInicio!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  permisosIds!: string[]; // UUIDs de los permisos a asignar
}
