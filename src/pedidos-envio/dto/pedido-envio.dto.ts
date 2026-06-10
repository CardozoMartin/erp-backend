import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateClienteDto } from 'src/clientes/dto/create-cliente.dto';
import {
  EstadoPedidoEnvio,
  EstadoPagoPedidoEnvio,
  MedioPagoPedidoEnvio,
} from '../entities/pedido-envio.entity';

export class PedidoEnvioItemDto {
  @IsUUID()
  producto_id!: string;

  @IsOptional()
  @IsUUID()
  variante_id?: string | null;

  @IsNumber()
  @Min(0.01)
  cantidad!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precio_unitario?: number;
}

export class CrearPedidoEnvioDto {
  @IsUUID()
  caja_id!: string;

  @IsOptional()
  @IsUUID()
  cliente_id?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateClienteDto)
  cliente_nuevo?: CreateClienteDto;

  @IsOptional()
  @IsUUID()
  empleado_repartidor_id?: string | null;

  @IsEnum(MedioPagoPedidoEnvio)
  medio_pago_previsto!: MedioPagoPedidoEnvio;

  @IsOptional()
  @IsEnum(EstadoPagoPedidoEnvio)
  estado_pago?: EstadoPagoPedidoEnvio;

  @IsString()
  direccion_entrega!: string;

  @IsOptional()
  @IsString()
  localidad_entrega?: string | null;

  @IsOptional()
  @IsString()
  barrio_entrega?: string | null;

  @IsOptional()
  @IsString()
  codigo_postal_entrega?: string | null;

  @IsOptional()
  @IsString()
  telefono_contacto?: string | null;

  @IsOptional()
  @IsString()
  referencia_entrega?: string | null;

  @IsOptional()
  @IsDateString()
  fecha_programada?: string | null;

  @IsOptional()
  @IsString()
  observaciones?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PedidoEnvioItemDto)
  items!: PedidoEnvioItemDto[];
}

export class CambiarEstadoPedidoEnvioDto {
  @IsEnum(EstadoPedidoEnvio)
  estado!: EstadoPedidoEnvio;

  @IsOptional()
  @IsUUID()
  empleado_repartidor_id?: string | null;

  @IsOptional()
  @IsString()
  observaciones?: string | null;
}

export class EditarPedidoEnvioDto {
  @IsOptional()
  @IsUUID()
  empleado_repartidor_id?: string | null;

  @IsOptional()
  @IsEnum(MedioPagoPedidoEnvio)
  medio_pago_previsto?: MedioPagoPedidoEnvio;

  @IsOptional()
  @IsEnum(EstadoPagoPedidoEnvio)
  estado_pago?: EstadoPagoPedidoEnvio;

  @IsOptional()
  @IsString()
  direccion_entrega?: string;

  @IsOptional()
  @IsString()
  localidad_entrega?: string | null;

  @IsOptional()
  @IsString()
  barrio_entrega?: string | null;

  @IsOptional()
  @IsString()
  codigo_postal_entrega?: string | null;

  @IsOptional()
  @IsString()
  telefono_contacto?: string | null;

  @IsOptional()
  @IsString()
  referencia_entrega?: string | null;

  @IsOptional()
  @IsDateString()
  fecha_programada?: string | null;

  @IsOptional()
  @IsString()
  observaciones?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PedidoEnvioItemDto)
  items!: PedidoEnvioItemDto[];
}

export class RendirPedidoEnvioDto {
  @IsUUID()
  caja_id!: string;

  @IsUUID()
  medio_pago_id!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monto_rendido?: number;

  @IsOptional()
  @IsString()
  referencia_pago?: string | null;

  @IsOptional()
  @IsString()
  observaciones?: string | null;
}
