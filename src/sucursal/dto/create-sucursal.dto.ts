// sucursales/dto/create-sucursal.dto.ts
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import {
  AnchoTicket,
  CondicionIva,
  TipoImpresora,
} from '../entities/sucursal.entity';

export class CreateSucursalDto {
  @IsString()
  @Matches(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    {
      message: 'empresa_id debe ser un UUID válido',
    },
  )
  empresa_id!: string;

  // Operativos
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  nombreFantasia?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  direccion?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  localidad?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  provincia?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  codigoPostal?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  telefono?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  // Fiscales
  @IsString()
  @IsOptional()
  @Matches(/^\d{2}-\d{8}-\d{1}$/, {
    message: 'CUIT debe tener formato XX-XXXXXXXX-X',
  })
  cuit?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  razonSocial?: string;

  @IsEnum(CondicionIva)
  @IsOptional()
  condicionIva?: CondicionIva;

  @IsString()
  @IsOptional()
  @MaxLength(4)
  puntoVentaArca?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  ingresosBrutos?: string;

  @IsDateString()
  @IsOptional()
  inicioActividades?: string;

  // Ticket
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  mensajePieTicket?: string;

  @IsEmail()
  @IsOptional()
  emailComprobantes?: string;

  @IsEnum(TipoImpresora)
  @IsOptional()
  tipoImpresora?: TipoImpresora;

  @IsEnum(AnchoTicket)
  @IsOptional()
  anchoTicket?: AnchoTicket;

  @IsBoolean()
  @IsOptional()
  activa?: boolean;
}

export class UpdateSucursalDto extends PartialType(CreateSucursalDto) {}
