// config-pos/dto/config-pos.dto.ts
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { FlujoVenta } from 'src/ventas-modulo/entities/ventas-modulo.entity';

export class ConfigPosDto {
  @IsEnum(FlujoVenta)
  @IsOptional()
  flujo?: FlujoVenta;

  @IsBoolean()
  @IsOptional()
  requiereDespacho?: boolean;

  @IsBoolean()
  @IsOptional()
  permiteClienteAnonimo?: boolean;

  @IsBoolean()
  @IsOptional()
  permitePagoMixto?: boolean;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  mediosPagoActivos?: string[];

  @IsUUID()
  @IsOptional()
  listaPrecioDefaultId?: string | null;
}
