import { OmitType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateComprobanteDto } from 'src/comprobantes/dto/create-comprobante.dto';
import { EmitirComprobanteFiscalDto } from 'src/facturacion/dto/emitir-comprobante-fiscal.dto';
import { CreateNotaCreditoDto } from 'src/notas-credito/dto/create-nota-credito.dto';
import { CobrarComprobanteDto } from 'src/pagos-pos/dto/create-pago-pos.dto';

export class CrearVentaPosDto extends OmitType(CreateComprobanteDto, [
  'tipo',
] as const) {
  @IsOptional()
  @IsString()
  observaciones?: string | null;
}

export class EmitirFiscalPosDto extends OmitType(EmitirComprobanteFiscalDto, [
  'venta_id',
] as const) {}

export class CobrarVentaPosDto extends CobrarComprobanteDto {
  @IsOptional()
  @IsBoolean()
  emitir_comprobante?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmitirFiscalPosDto)
  comprobante_fiscal?: EmitirFiscalPosDto;
}

export class VentaCompletaPosDto extends CrearVentaPosDto {
  @ValidateNested()
  @Type(() => CobrarComprobanteDto)
  cobro!: CobrarComprobanteDto;

  @IsOptional()
  @IsBoolean()
  emitir_comprobante?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmitirFiscalPosDto)
  comprobante_fiscal?: EmitirFiscalPosDto;
}

export class CancelarVentaPosDto {
  @IsOptional()
  @IsString()
  motivo?: string | null;
}

export class DevolverVentaPosDto extends OmitType(CreateNotaCreditoDto, [
  'comprobante_origen_id',
] as const) {}

export class EmitirDesdeVentaDto {
  @IsUUID()
  venta_id!: string;

  @ValidateNested()
  @Type(() => EmitirFiscalPosDto)
  comprobante_fiscal!: EmitirFiscalPosDto;
}
