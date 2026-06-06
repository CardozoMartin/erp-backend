import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';

export enum DestinoNotaCredito {
  SALDO_CUENTA = 'SALDO_CUENTA',
  REEMBOLSO = 'REEMBOLSO',
  SOLO_EMITIR = 'SOLO_EMITIR',
}

export class NotaCreditoItemDto {
  @IsUUID()
  comprobante_item_id!: string;

  @IsNumber()
  @Min(0)
  cantidad!: number;
}

export class CreateNotaCreditoDto {
  @IsUUID()
  comprobante_origen_id!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotaCreditoItemDto)
  items?: NotaCreditoItemDto[];

  @IsOptional()
  @IsEnum(DestinoNotaCredito)
  destino?: DestinoNotaCredito;

  @IsOptional()
  @IsBoolean()
  reingresar_stock?: boolean;

  @IsOptional()
  @IsUUID()
  caja_id?: string;

  @IsOptional()
  @IsUUID()
  medio_pago_id?: string;

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
