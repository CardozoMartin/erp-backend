import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoPagoPos } from '../entities/pago-pos.entity';

export class PagoPosItemDto {
  @IsEnum(TipoPagoPos)
  tipo!: TipoPagoPos;

  @IsNumber()
  @IsPositive()
  @Max(99_999_999)
  monto!: number;

  @IsOptional()
  @IsUUID()
  medio_pago_id?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  cuotas?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  recargo_porcentaje?: number;

  @IsOptional()
  @IsString()
  referencia?: string | null;
}

export class CobrarComprobanteDto {
  @IsUUID()
  caja_id!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PagoPosItemDto)
  pagos!: PagoPosItemDto[];
}
