import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateProductoCategoriaDto {
  @IsString()
  nombre!: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsString()
  @IsOptional()
  padre_id?: string;
}
