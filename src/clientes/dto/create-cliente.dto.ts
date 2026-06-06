// clientes/dto/create-cliente.dto.ts
import {
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  IsEmail,
  ValidateNested,
  IsInt,
  Min,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoCliente } from '../entities/cliente.entity';
import { TipoVencimiento } from '../entities/plan-pago.entity';

export class CreatePlanPagoDto {
  @IsEnum(TipoVencimiento)
  tipo_vencimiento!: TipoVencimiento;

  // Día del mes (1-31) o cantidad de días según tipo_vencimiento
  @IsInt()
  @Min(1)
  valor_vencimiento!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  recargo_porcentaje_diario?: number;

  @IsOptional()
  @IsBoolean()
  recargo_activo?: boolean;
}

export class CreateCuentaCorrienteDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  limite_credito?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePlanPagoDto)
  planPago?: CreatePlanPagoDto;
}

export class CreateClienteDto {
  @IsString()
  nombre!: string;

  @IsOptional()
  @IsString()
  apellido?: string;

  @IsOptional()
  @IsString()
  razon_social?: string;

  @IsOptional()
  @IsEnum(TipoCliente)
  tipo?: TipoCliente;

  @IsOptional()
  @IsString()
  cuit?: string;

  @IsOptional()
  @IsString()
  dni?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  altura?: string;

  @IsOptional()
  @IsString()
  barrio?: string;

  @IsOptional()
  @IsString()
  localidad?: string;

  @IsOptional()
  @IsString()
  codigo_postal?: string;

  @IsOptional()
  @IsString()
  referencia_entrega?: string;

  // Si se envía, se crea la cuenta corriente automáticamente
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCuentaCorrienteDto)
  cuentaCorriente?: CreateCuentaCorrienteDto;
}
