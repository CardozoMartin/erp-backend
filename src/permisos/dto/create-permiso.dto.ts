import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// crear-permiso.dto.ts
export class CrearPermisoDto {
  @IsString()
  @IsNotEmpty()
  clave!: string;

  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  modulo!: string;

  @IsString()
  @IsOptional()
  descripcion?: string;
}
