// dto/create-pagos-module.dto.ts
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { TipoMedioPago } from '../entities/medio-pago.entity';

export class CrearMedioPagoDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsEnum(TipoMedioPago)
  tipo!: TipoMedioPago;

  @IsBoolean()
  @IsOptional()
  requiereReferencia?: boolean;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
