import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAtributoVarianteDto {
  @IsUUID()
  variante_id!: string;

  @IsString()
  @MaxLength(50)
  tipo!: string;

  @IsString()
  @MaxLength(100)
  valor!: string;

  @IsOptional()
  @IsString()
  metadata?: string;
}
