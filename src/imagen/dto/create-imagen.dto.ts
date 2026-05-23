import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { RolImagen } from '../entities/imagen.entity';

export class CreateImagenDto {
  @IsUUID()
  producto_id!: string;

  @IsOptional()
  @IsUUID()
  variante_id?: string;

  @IsOptional()
  @IsEnum(RolImagen)
  rol?: RolImagen;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsString()
  reemplazar_rol?: string;

  @IsOptional()
  @IsUUID()
  reemplazar_imagen_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt_text?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  orden?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ancho_px?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  alto_px?: number;
}
