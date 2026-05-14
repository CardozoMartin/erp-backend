import { IsString, Matches, IsNotEmpty, IsOptional, MaxLength, IsBoolean } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateSucursalDto {
  @IsString()
  @Matches(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, {
    message: 'empresa_id must be a valid UUID-like string',
  })
  empresa_id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  direccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

export class UpdateSucursalDto extends PartialType(CreateSucursalDto) {}
