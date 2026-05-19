import {
  IsUUID,
  IsOptional,
  IsNumber,
  IsString,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateProductoPrecioDto {
  @IsUUID()
  producto_id!: string;

  @IsOptional()
  @IsUUID()
  sucursal_id?: string | null;

  @IsNumber()
  @Min(0)
  precio!: number;

  @IsOptional()
  @IsString()
  moneda?: string; // default 'ARS' en la entidad

  @IsDateString()
  vigente_desde!: string;
}
