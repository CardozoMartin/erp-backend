// empleados/dto/empleado-sucursal.dto.ts
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class AsignarSucursalDto {
  @IsUUID()
  sucursalId!: string;

  @IsBoolean()
  @IsOptional()
  esPrincipal?: boolean;
}

export class DesasignarSucursalDto {
  @IsUUID()
  sucursalId!: string;
}
