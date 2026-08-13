import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class GuardarArcaDto {
  @IsUUID()
  sucursalId!: string;

  /** CUIT en formato XX-XXXXXXXX-X */
  @IsString()
  @Matches(/^\d{2}-\d{8}-\d{1}$/, { message: 'CUIT debe tener formato XX-XXXXXXXX-X' })
  cuit!: string;

  /** Número de punto de venta AFIP (1-4 dígitos, se completa con ceros a la izquierda) */
  @IsString()
  @Matches(/^\d{1,4}$/, { message: 'El punto de venta debe ser numérico de 1 a 4 dígitos' })
  puntoVenta!: string;

  /** Contenido del certificado digital (.crt) en texto plano — se cifrará en el servidor */
  @IsString()
  certificado!: string;

  /** Contenido de la clave privada (.key) en texto plano — se cifrará en el servidor */
  @IsString()
  clavePrivada!: string;

  @IsOptional()
  @IsEnum(['testing', 'produccion'])
  ambiente?: 'testing' | 'produccion';
}

export class TestArcaDto {
  @IsUUID()
  sucursalId!: string;
}

export class CambiarAmbienteArcaDto {
  @IsUUID()
  sucursalId!: string;

  @IsEnum(['testing', 'produccion'])
  ambiente!: 'testing' | 'produccion';
}
