import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ProveedorEmail,
  SeguridadEmail,
} from '../entities/configuracion-email.entity';

export class UpsertConfiguracionEmailDto {
  @IsString()
  sucursal_id!: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsEnum(ProveedorEmail)
  proveedor?: ProveedorEmail;

  @IsEmail()
  @MaxLength(120)
  email_remitente!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre_remitente?: string | null;

  @IsString()
  @MaxLength(160)
  usuario!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  smtp_host?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtp_port?: number;

  @IsOptional()
  @IsEnum(SeguridadEmail)
  seguridad?: SeguridadEmail;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  password?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email_respuesta?: string | null;

  @IsOptional()
  @IsBoolean()
  enviar_facturas_email?: boolean;

  @IsOptional()
  @IsBoolean()
  enviar_facturas_automaticamente?: boolean;

  @IsOptional()
  @IsBoolean()
  adjuntar_pdf?: boolean;

  @IsOptional()
  @IsBoolean()
  copia_oculta_admin?: boolean;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email_copia_admin?: string | null;
}

export class ProbarConfiguracionEmailDto {
  @IsEmail()
  @MaxLength(120)
  destino!: string;
}
