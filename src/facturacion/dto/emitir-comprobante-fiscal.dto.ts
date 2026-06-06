import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TipoComprobante } from 'src/comprobantes/entities/comprobante.entity';

export enum TipoEmisionFiscal {
  TICKET = 'TICKET',
  FACTURA_A = 'FACTURA_A',
  FACTURA_B = 'FACTURA_B',
  FACTURA_C = 'FACTURA_C',
}

export class EmitirComprobanteFiscalDto {
  @IsUUID()
  venta_id!: string;

  @IsEnum(TipoEmisionFiscal)
  tipo!: TipoEmisionFiscal;

  @IsOptional()
  @IsUUID()
  cliente_id?: string | null;

  @IsOptional()
  @IsString()
  codigo_fiscal?: string | null;

  @IsOptional()
  @IsString()
  cae?: string | null;

  @IsOptional()
  @IsString()
  cae_vencimiento?: string | null;

  @IsOptional()
  @IsString()
  observaciones?: string | null;
}

export class AnularComprobanteFiscalDto {
  @IsOptional()
  @IsString()
  motivo?: string | null;
}

export const tipoFiscalAComprobante = (
  tipo: TipoEmisionFiscal,
): TipoComprobante => {
  if (tipo === TipoEmisionFiscal.FACTURA_A) return TipoComprobante.FACTURA_A;
  if (tipo === TipoEmisionFiscal.FACTURA_B) return TipoComprobante.FACTURA_B;
  if (tipo === TipoEmisionFiscal.FACTURA_C) return TipoComprobante.FACTURA_C;
  return TipoComprobante.TICKET;
};
