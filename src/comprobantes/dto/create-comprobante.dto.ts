import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  EstadoComprobante,
  TipoComprobante,
} from '../entities/comprobante.entity';

export class CreateComprobanteItemDto {
  @IsOptional()
  @IsUUID()
  producto_id?: string | null;

  @IsOptional()
  @IsUUID()
  variante_id?: string | null;

  @IsOptional()
  @IsUUID()
  comprobante_item_origen_id?: string | null;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsNumber()
  @Min(0)
  cantidad!: number;

  @IsNumber()
  @Min(0)
  precio_unitario!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento_porcentaje?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento_monto?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  recargo_monto?: number;
}

export class CreateComprobanteDto {
  @IsEnum(TipoComprobante)
  tipo!: TipoComprobante;

  @IsOptional()
  @IsEnum(EstadoComprobante)
  estado?: EstadoComprobante;

  @IsOptional()
  @IsUUID()
  caja_id?: string | null;

  @IsOptional()
  @IsUUID()
  cliente_id?: string | null;

  @IsOptional()
  @IsUUID()
  empleado_vendedor_id?: string | null;

  @IsOptional()
  @IsUUID()
  empleado_cajero_id?: string | null;

  @IsOptional()
  @IsUUID()
  empleado_despachador_id?: string | null;

  @IsOptional()
  @IsUUID()
  comprobante_origen_id?: string | null;

  @IsOptional()
  @IsUUID()
  lista_precio_id?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento_global_porcentaje?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento_global_monto?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  recargo_total?: number;

  @IsOptional()
  @IsString()
  observaciones?: string | null;

  @IsOptional()
  @IsDateString()
  fecha_vencimiento?: string | null;

  @IsOptional()
  @IsString()
  punto_venta?: string | null;

  @IsOptional()
  @IsString()
  codigo_fiscal?: string | null;

  @IsOptional()
  @IsString()
  cae?: string | null;

  @IsOptional()
  @IsDateString()
  cae_vencimiento?: string | null;

  @IsOptional()
  @IsBoolean()
  omitir_validacion_stock?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateComprobanteItemDto)
  items!: CreateComprobanteItemDto[];
}

export class CambiarEstadoComprobanteDto {
  @IsEnum(EstadoComprobante)
  estado!: EstadoComprobante;

  @IsOptional()
  @IsString()
  observaciones?: string | null;
}
