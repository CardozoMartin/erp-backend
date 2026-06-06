import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { MotivoPendienteDespacho } from '../entities/despacho-item.entity';

export class CrearDespachoDto {
  @IsUUID()
  comprobante_id!: string;

  @IsOptional()
  @IsString()
  observaciones?: string | null;
}

export class EntregarDespachoItemDto {
  @IsUUID()
  despacho_item_id!: string;

  @IsNumber()
  @Min(0)
  cantidad_despachada!: number;

  @IsOptional()
  @IsEnum(MotivoPendienteDespacho)
  motivo_pendiente?: MotivoPendienteDespacho | null;
}

export class EntregarDespachoDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntregarDespachoItemDto)
  items!: EntregarDespachoItemDto[];

  @IsOptional()
  @IsBoolean()
  generar_remito?: boolean;

  @IsOptional()
  @IsString()
  observaciones?: string | null;
}

export class AnularDespachoDto {
  @IsOptional()
  @IsString()
  motivo?: string | null;
}
