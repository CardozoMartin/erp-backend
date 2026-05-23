import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RolImagen } from '../../imagen/entities/imagen.entity';
import { CreateProductoPrecioDto } from '../../producto_precios/dto/create-producto_precio.dto';
import { UnidadVenta } from '../entities/producto.entity';
import { CreateStockDto, UpdateStockDto } from '../../stock/dto/create-stock.dto';

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

// ─── DTO de atributo de producto ───
export class CreateAtributoProductoDto {
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
  precio_extra?: number; // precio adicional sobre precio_base (puede ser negativo para descuentos)

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAtributoVarianteDto)
  atributos?: CreateAtributoVarianteDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStockDto)
  stock?: CreateStockDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLoteDto)
  lotes?: CreateLoteDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateImagenDto)
  imagenes?: CreateImagenDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOfertaDto)
  ofertas?: CreateOfertaDto[];
}

// ─── DTO de variante para ACTUALIZACIÓN ───
export class UpdateVarianteDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @IsOptional()
  @IsNumber()
  precio_extra?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAtributoVarianteDto)
  atributos?: CreateAtributoVarianteDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateStockDto)
  stock?: UpdateStockDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLoteDto)
  lotes?: CreateLoteDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateImagenDto)
  imagenes?: CreateImagenDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOfertaDto)
  ofertas?: CreateOfertaDto[];
}

// ─── DTO para registrar lote con vencimiento ───
export class CreateLoteDto {
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsString()
  sucursal_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  numero_lote?: string;

  @IsDate()
  @Type(() => Date)
  fecha_vencimiento!: Date;

  @IsNumber()
  @Min(0)
  cantidad!: number;
}

// ─── DTO para registrar imagen ───
export class CreateImagenDto {
  @IsOptional()
  @IsEnum(RolImagen)
  rol?: RolImagen;

  @IsString()
  @MaxLength(500)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt_text?: string;

  @IsOptional()
  @IsNumber()
  orden?: number;

  @IsOptional()
  @IsNumber()
  ancho_px?: number;

  @IsOptional()
  @IsNumber()
  alto_px?: number;
}

// ─── DTO para crear oferta ───
export class CreateOfertaDto {
  @IsNumber()
  @Min(0)
  precio_oferta!: number;

  @IsDate()
  @Type(() => Date)
  fecha_inicio!: Date;

  @IsDate()
  @Type(() => Date)
  fecha_fin!: Date;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
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
  codigo_barras?: string | null;

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

  @IsOptional()
  @IsUUID()
  marca_id?: string;

  // ─── Variantes opcionales al crear ───
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVarianteDto)
  variantes?: CreateVarianteDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAtributoProductoDto)
  atributos?: CreateAtributoProductoDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStockDto)
  stock?: CreateStockDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLoteDto)
  lotes?: CreateLoteDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateImagenDto)
  imagenes?: CreateImagenDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOfertaDto)
  ofertas?: CreateOfertaDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductoPrecioDto)
  precios?: CreateProductoPrecioDto[];
}

// ─── DTO de actualización con variantes actualizables ───
export class UpdateProductoDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  codigo_barras?: string | null;

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

  @IsOptional()
  @IsNumber()
  @Min(0)
  precio_base?: number;

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

  @IsOptional()
  @IsUUID()
  marca_id?: string;

  // ─── Variantes con DTOs de actualización ───
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateVarianteDto)
  variantes?: UpdateVarianteDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAtributoProductoDto)
  atributos?: CreateAtributoProductoDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateStockDto)
  stock?: UpdateStockDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLoteDto)
  lotes?: CreateLoteDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateImagenDto)
  imagenes?: CreateImagenDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOfertaDto)
  ofertas?: CreateOfertaDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductoPrecioDto)
  precios?: CreateProductoPrecioDto[];
}

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
