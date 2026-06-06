import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

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

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  deposito?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(80)
  pasillo?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(80)
  estante?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  sector?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(80)
  codigo_ubicacion?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(255)
  ubicacion_referencia?: string | null;
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
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  deposito?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(80)
  pasillo?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(80)
  estante?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  sector?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(80)
  codigo_ubicacion?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(255)
  ubicacion_referencia?: string | null;

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
