import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { TipoMovimientoStock } from '../entities/stock-movimiento.entity';

export enum OperacionAjusteStock {
  AUMENTAR = 'AUMENTAR',
  RESTAR = 'RESTAR',
  AJUSTAR = 'AJUSTAR',
}

export class AjusteManualStockDto {
  @IsUUID()
  producto_id!: string;

  @IsOptional()
  @IsUUID()
  variante_id?: string | null;

  @IsEnum(OperacionAjusteStock)
  operacion!: OperacionAjusteStock;

  @IsNumber()
  @Min(0)
  cantidad!: number;

  @IsOptional()
  @IsEnum(TipoMovimientoStock)
  tipo?: TipoMovimientoStock;

  @IsOptional()
  @IsString()
  descripcion?: string | null;

  @IsOptional()
  @IsUUID()
  cajaId?: string;
}
