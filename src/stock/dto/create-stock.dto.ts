import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateStockDto {
  @IsUUID()
  producto_id!: string;

  @IsOptional()
  @IsUUID()
  variante_id?: string;

  @IsUUID()
  sucursal_id!: string;

  @IsOptional()
  @IsNumber()
  cantidad?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidad_minima?: number;
}
