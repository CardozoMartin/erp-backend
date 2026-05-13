import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateVarianteDto {
  @IsUUID()
  producto_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precio_extra?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
