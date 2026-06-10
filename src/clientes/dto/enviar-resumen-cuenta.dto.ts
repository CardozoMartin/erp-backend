import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum TipoResumenCuenta {
  CARGOS = 'CARGOS',
  COMPRAS = 'COMPRAS',
  CARGOS_Y_RECARGOS = 'CARGOS_Y_RECARGOS',
  TODOS = 'TODOS',
}

export class EnviarResumenCuentaDto {
  @IsEmail()
  @MaxLength(120)
  destino!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  asunto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  mensaje?: string;

  @IsOptional()
  @IsString()
  desde?: string;

  @IsOptional()
  @IsString()
  hasta?: string;

  @IsOptional()
  @IsEnum(TipoResumenCuenta)
  tipo_resumen?: TipoResumenCuenta;

  @IsOptional()
  @IsBoolean()
  adjuntar_pdf?: boolean;
}
