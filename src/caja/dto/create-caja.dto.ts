import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { TipoMovimientoCaja } from '../entities/movimiento-caja.entity';
import { CategoriaMovimientoCaja } from '../entities/movimiento-caja.entity';

export class AbrirCajaDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  monto_inicial?: number;

  @IsOptional()
  @IsString()
  descripcion?: string;
}

export class RegistrarMovimientoCajaDto {
  @IsEnum(TipoMovimientoCaja)
  tipo!: TipoMovimientoCaja.INGRESO_MANUAL | TipoMovimientoCaja.EGRESO | TipoMovimientoCaja.AJUSTE;

  @IsNumber()
  @Min(0)
  monto!: number;

  @IsOptional()
  @IsUUID()
  medio_pago_id?: string | null;

  @IsOptional()
  @IsEnum(CategoriaMovimientoCaja)
  categoria_egreso?: CategoriaMovimientoCaja | null;

  @IsOptional()
  @IsString()
  entidad_nombre?: string | null;

  @IsOptional()
  @IsString()
  referencia?: string | null;

  @IsOptional()
  @IsString()
  descripcion?: string | null;
}

export class CerrarCajaDto {
  @IsNumber()
  @Min(0)
  monto_final_declarado!: number;

  @IsOptional()
  @IsString()
  descripcion?: string;
}
