import { IsDate, IsBoolean, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOfertaDto {
  @IsUUID()
  producto_id!: string;

  @IsOptional()
  @IsUUID()
  variante_id?: string;

  @IsNumber()
  @Min(0)
  precio_oferta!: number;

  @IsDate()
  @Type(() => Date)
  fecha_inicio!: Date;

  @IsDate()
  @Type(() => Date)
  fecha_fin!: Date;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  cantidad_maxima?: number | null;
}
