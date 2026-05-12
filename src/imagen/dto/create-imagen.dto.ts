import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { RolImagen } from '../../producto/entities/imagen.entity';

export class CreateImagenDto {
  @IsUUID()
  producto_id!: string;

  @IsOptional()
  @IsUUID()
  variante_id?: string;

  @IsOptional()
  @IsEnum(RolImagen)
  rol?: RolImagen;

  @IsString()
  @MaxLength(500)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt_text?: string;

  @IsOptional()
  @IsNumber()
  orden?: number;

  @IsOptional()
  @IsNumber()
  ancho_px?: number;

  @IsOptional()
  @IsNumber()
  alto_px?: number;
}
