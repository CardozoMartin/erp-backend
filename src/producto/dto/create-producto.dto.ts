import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsUUID,
  MaxLength,
  Min,
  IsArray,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { UnidadVenta } from '../entities/producto.entity';

// ─── DTO de atributo de variante ───
export class CreateAtributoVarianteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  tipo!: string; // 'color', 'talle', 'sabor', 'presentacion', etc.

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  valor!: string; // 'Rojo', 'XL', 'Frutilla', etc.
}

// ─── DTO de variante dentro de creación de producto ───
export class CreateVarianteDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precio_extra?: number; // precio adicional sobre precio_base

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAtributoVarianteDto)
  atributos!: CreateAtributoVarianteDto[];
}

// ─── DTO principal de creación ───
export class CreateProductoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  codigo_barras?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsBoolean()
  activo_pos?: boolean;

  @IsOptional()
  @IsBoolean()
  activo_web?: boolean;

  @IsNumber()
  @Min(0)
  precio_base!: number;

  @IsOptional()
  @IsEnum(UnidadVenta)
  unidad_venta?: UnidadVenta;

  @IsOptional()
  @IsBoolean()
  tiene_variantes?: boolean;

  @IsOptional()
  @IsBoolean()
  tiene_vencimiento?: boolean;

  @IsOptional()
  @IsBoolean()
  es_fraccionable?: boolean;

  @IsOptional()
  @IsUUID()
  categoria_id?: string;

  // ─── Variantes opcionales al crear ───
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVarianteDto)
  variantes?: CreateVarianteDto[];
}

// ─── DTO de actualización (todos opcionales) ───
export class UpdateProductoDto extends PartialType(CreateProductoDto) {}

// ─── DTO de filtros para listado/búsqueda ───
export class FiltrosProductoDto {
  @IsOptional()
  @IsString()
  busqueda?: string; // nombre o código de barras

  @IsOptional()
  @IsUUID()
  categoria_id?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  activo?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  activo_pos?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  activo_web?: boolean;

  @IsOptional()
  @IsEnum(UnidadVenta)
  unidad_venta?: UnidadVenta;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  tiene_variantes?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  tiene_vencimiento?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  pagina?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limite?: number;
}

// ─── DTO para crear oferta sobre un producto o variante ───
export class CreateOfertaDto {
  @IsOptional()
  @IsUUID()
  variante_id?: string;

  @IsNumber()
  @Min(0)
  precio_oferta!: number;

  @Type(() => Date)
  fecha_inicio!: Date;

  @Type(() => Date)
  fecha_fin!: Date;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

// ─── DTO para registrar/ajustar stock ───
export class AjusteStockDto {
  @IsOptional()
  @IsUUID()
  variante_id?: string;

  @IsUUID()
  sucursal_id!: string;

  @IsNumber()
  cantidad!: number; // positivo = ingreso, negativo = egreso

  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidad_minima?: number;
}

// ─── DTO para registrar lote con vencimiento ───
export class CreateLoteDto {
  @IsOptional()
  @IsUUID()
  variante_id?: string;

  @IsUUID()
  sucursal_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  numero_lote?: string;

  @Type(() => Date)
  fecha_vencimiento!: Date;

  @IsNumber()
  @Min(0)
  cantidad!: number;
}