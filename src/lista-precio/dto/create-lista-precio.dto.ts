import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { TipoAjustePrecio } from '../entities/lista-precio.entity';
import { ModoIvaListaPrecio, TipoListaPrecio } from '../entities/lista-precio.entity';

export class CreateListaPrecioDto {
  @IsString()
  nombre!: string;

  @IsOptional()
  @IsString()
  sucursal_id?: string;

  @IsOptional()
  @IsEnum(TipoListaPrecio)
  tipo_lista?: TipoListaPrecio;

  @IsEnum(TipoAjustePrecio)
  tipo_ajuste!: TipoAjustePrecio;

  @IsNumber()
  @Min(0)
  @Max(100)
  porcentaje!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  cuotas?: number;

  @IsOptional()
  @IsEnum(ModoIvaListaPrecio)
  modo_iva?: ModoIvaListaPrecio;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentaje_iva?: number;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
