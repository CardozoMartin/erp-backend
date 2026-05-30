// ventas/dto/crear-venta.dto.ts
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoDocumento } from '../enum/tipo-documento.enum';

export class CrearVentaItemDto {
  @IsUUID()
  producto_id!: string;

  @IsUUID()
  @IsOptional()
  variante_id?: string;

  @IsString()
  @IsNotEmpty()
  descripcion!: string;

  @IsNumber()
  @Min(0)
  precio_unitario!: number;

  @IsNumber()
  @Min(1)
  cantidad!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  descuento_porcentaje?: number;
}

export class CrearVentaDto {
  @IsEnum(TipoDocumento)
  @IsOptional()
  tipoDocumento?: TipoDocumento;

  @IsUUID()
  @IsOptional()
  sucursal_id?: string;

  @IsUUID()
  @IsOptional()
  empleado_id?: string;

  @IsUUID()
  @IsOptional()
  cliente_id?: string;

  @IsUUID()
  @IsOptional()
  lista_precio_id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearVentaItemDto)
  items!: CrearVentaItemDto[];

  @IsString()
  @IsOptional()
  notas?: string;
}

// ventas/dto/cobrar-venta.dto.ts
export class PagoDto {
  @IsUUID()
  medio_pago_id!: string;

  @IsNumber()
  @Min(0)
  monto!: number;

  @IsString()
  @IsOptional()
  referencia?: string;
}

export class CobrarVentaDto {
  @IsUUID()
  @IsOptional()
  cajero_id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PagoDto)
  pagos!: PagoDto[];
}
