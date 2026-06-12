import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

// crear-empleado.dto.ts
export class CrearEmpleadoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombreCompleto!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  contrasena!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  telefono!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  direccion!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  cargo!: string;

  @IsString()
  @IsOptional()
  foto_url?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  rolesIds?: string[];
  @IsUUID()
  @IsOptional()
  sucursalId?: string; // ← nuevo

  @IsBoolean()
  @IsOptional()
  esSucursalPrincipal?: boolean;

  @IsBoolean()
  @IsOptional()
  bono_ventas_activo?: boolean;

  @IsNumber()
  @IsOptional()
  meta_mensual_ventas?: number;

  @IsNumber()
  @IsOptional()
  bono_mensual_ventas?: number;
}

// asignar-roles.dto.ts  ← para el endpoint PATCH /empleados/:id/roles
export class AsignarRolesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  rolesIds!: string[];
}

// respuesta-empleado.dto.ts  ← lo que devolvés, SIN password
export class RespuestaEmpleadoDto {
  id!: string;
  nombreCompleto!: string;
  email!: string;
  telefono!: string;
  direccion!: string;
  cargo!: string;
  foto_url!: string | null;
  activo!: boolean;
  bono_ventas_activo!: boolean;
  meta_mensual_ventas!: number;
  bono_mensual_ventas!: number;
  ventas_mes_actual!: number;
  avance_bono_ventas!: number;
  bono_ventas_corresponde!: boolean;
  roles!: { id: string; nombre: string; rutaInicio: string }[];
  permisos!: string[]; // ['ventas.crear', 'caja.cobrar', ...]
  permisosExtra?: {
    permiso: { id: string; clave: string; nombre: string; modulo: string };
    tipo: 'grant' | 'revoke';
    sucursalId: string;
  }[];
  sucursales!: {
    id: string;
    nombre: string;
    esPrincipal: boolean;
    activo: boolean;
  }[];
}
