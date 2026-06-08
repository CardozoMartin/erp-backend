import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class RegistrarCargoCuentaDto {
  @IsNumber()
  @Min(0)
  monto!: number;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  comprobante_id?: string;

  @IsOptional()
  @IsDateString()
  fecha_vencimiento?: string;
}

export class RegistrarPagoCuentaDto {
  @IsNumber()
  @Min(0)
  monto!: number;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  comprobante_id?: string;

  @IsUUID()
  caja_id!: string;

  @IsOptional()
  @IsUUID()
  medio_pago_id?: string | null;

  @IsOptional()
  @IsString()
  referencia?: string | null;
}

export class RegistrarNotaCreditoCuentaDto {
  @IsNumber()
  @Min(0)
  monto!: number;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  comprobante_id?: string;
}

export class RegistrarAjusteCuentaDto {
  @IsNumber()
  monto!: number;

  @IsOptional()
  @IsString()
  descripcion?: string;
}

export class CalcularRecargosCuentaDto {
  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsBoolean()
  solo_simular?: boolean;
}
