// configuracion/dto/create-configuracion.dto.ts
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsBoolean,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import {
  ModoPOS,
  DescuentoStock,
  FormatoImpresionComprobante,
  DisenoComprobante,
} from '../entities/configuracion.entity';

export class CreateConfiguracionDto {
  @IsString()
  sucursal_id!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  cotizacion_vigencia_horas?: number;

  @IsOptional()
  @IsEnum(ModoPOS)
  modo_pos?: ModoPOS;

  @IsOptional()
  @IsEnum(DescuentoStock)
  descuento_stock?: DescuentoStock;

  @IsOptional()
  @IsBoolean()
  permitir_pago_mixto?: boolean;

  @IsOptional()
  @IsBoolean()
  permitir_listas_precio?: boolean;

  @IsOptional()
  @IsBoolean()
  permitir_cotizaciones?: boolean;

  @IsOptional()
  @IsString()
  prefijo_ticket?: string;

  @IsOptional()
  @IsString()
  prefijo_cotizacion?: string;

  @IsOptional()
  @IsString()
  prefijo_remito?: string;

  @IsOptional()
  @IsString()
  prefijo_nota_credito?: string;

  @IsOptional()
  @IsString()
  punto_venta_arca?: string;

  @IsOptional()
  @IsBoolean()
  permitir_cuenta_corriente?: boolean;

  @IsOptional()
  @IsEnum(FormatoImpresionComprobante)
  formato_impresion_comprobante?: FormatoImpresionComprobante;

  @IsOptional()
  @IsBoolean()
  imprimir_automaticamente?: boolean;

  @IsOptional()
  @IsEnum(DisenoComprobante)
  diseno_comprobante?: DisenoComprobante;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre_fantasia_ticket?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  razon_social_ticket?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cuit_ticket?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ingresos_brutos_ticket?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  inicio_actividades_ticket?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  domicilio_ticket?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  telefono_ticket?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  email_ticket?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  web_ticket?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  mensaje_ticket?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  mensaje_boleta?: string | null;

  @IsOptional()
  @IsBoolean()
  mostrar_detalle_productos?: boolean;

  @IsOptional()
  @IsBoolean()
  mostrar_descuentos?: boolean;

  @IsOptional()
  @IsBoolean()
  mostrar_recargos?: boolean;

  @IsOptional()
  @IsBoolean()
  mostrar_observaciones?: boolean;

  @IsOptional()
  @IsBoolean()
  mostrar_datos_fiscales?: boolean;

  @IsOptional()
  @IsBoolean()
  consulta_stock_otras_sucursales?: boolean;
}
