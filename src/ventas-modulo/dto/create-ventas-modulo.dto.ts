import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ESTADO } from '../entities/ventas-modulo.entity';

export class CreateVentaItemDto {
  @IsString()
  producto_id!: string;

  @IsOptional()
  @IsString()
  variante_id?: string;

  @IsInt()
  @IsPositive()
  cantidad!: number;

  @IsOptional()
  @IsNumber()
  precio_unitario?: number; // si no viene, se toma del producto

  @IsOptional()
  @IsNumber()
  descuento_porcentaje?: number; // 0 por defecto
}

export class CreateVentasModuloDto {
  @IsOptional()
  @IsEnum(ESTADO)
  estado?: ESTADO;

  @IsOptional()
  @IsString()
  caja_id?: string;

  @IsOptional()
  @IsString()
  sucursal_id?: string;

  @IsOptional()
  @IsString()
  cliente_id?: string;

  @IsOptional()
  @IsString()
  usuario_id?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVentaItemDto)
  items!: CreateVentaItemDto[];
}
