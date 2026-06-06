import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoPagoPos } from '../entities/pago-pos.entity';

export class PagoPosItemDto {
  @IsEnum(TipoPagoPos)
  tipo!: TipoPagoPos;

  @IsNumber()
  @Min(0)
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
  @ValidateNested({ each: true })
  @Type(() => PagoPosItemDto)
  pagos!: PagoPosItemDto[];
}
