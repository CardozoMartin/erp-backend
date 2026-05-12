import { IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class CreateStocksProductDto {
     @IsUUID()
  producto_id!: string;

  @IsOptional()
  @IsUUID()
  variante_id?: string;

  @IsString()
  sucursal_id!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidad?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidad_minima?: number;
}

export class AjustarStockDto {
  @IsNumber()
  cantidad!: number; // puede ser negativo para reducir
}
