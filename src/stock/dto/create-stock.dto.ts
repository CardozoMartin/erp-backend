import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateStockDto {
  @IsUUID()
  producto_id!: string;

  @IsOptional()
  @IsUUID()
  variante_id?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsString()
  sucursal_id?: string | null;

  @IsOptional()
  @IsNumber()
  cantidad?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidad_minima?: number;
}

// DTO para ajustar stock (sumar/restar cantidades por ventas/compras)
export class AjustarStockDto {
  @IsNumber()
  cantidad!: number; // positivo para sumar, negativo para restar
}
