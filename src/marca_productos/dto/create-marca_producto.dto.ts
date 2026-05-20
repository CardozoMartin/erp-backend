import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateMarcaProductoDto {
  @IsString()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsUrl()
  @IsOptional()
  logo_url?: string;

  @IsBoolean()
  @IsOptional()  // 👈 esto es lo que falta
  activo?: boolean;
}