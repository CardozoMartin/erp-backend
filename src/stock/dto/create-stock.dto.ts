import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateStockDto {
  @IsUUID()
  producto_id!: string;

  @IsOptional()
  @IsUUID()
  variante_id?: string;

  @IsOptional()
  @Transform(({ value }) => value ?? '')
  @IsString()
  sucursal_id?: string;

  @IsOptional()
  @IsNumber()
  cantidad?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidad_minima?: number;
}
