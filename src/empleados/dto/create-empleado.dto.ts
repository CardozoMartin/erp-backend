import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
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
  password!: string;

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

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  rolesIds!: string[];
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
  roles!: { id: string; nombre: string; rutaInicio: string }[];
  permisos!: string[]; // ['ventas.crear', 'caja.cobrar', ...]
}
