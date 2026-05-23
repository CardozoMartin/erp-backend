import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateStockDto {
  @IsOptional()
  @IsUUID()
  producto_id?: string;

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

// DTO para actualizar stock (permite id, created_at, updated_at sin rechazo)
export class UpdateStockDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsUUID()
  producto_id?: string;

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

  @IsOptional()
  created_at?: Date;

  @IsOptional()
  updated_at?: Date;
}

// DTO para ajustar stock (sumar/restar cantidades por ventas/compras)
export class AjustarStockDto {
  @IsNumber()
  cantidad!: number; // positivo para sumar, negativo para restar
}
