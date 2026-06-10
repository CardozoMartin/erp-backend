import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertConfiguracionCloudinaryDto {
  @IsString()
  @MaxLength(120)
  cloud_name!: string;

  @IsString()
  @MaxLength(160)
  api_key!: string;

  @IsOptional()
  @IsString()
  api_secret?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  carpeta_base?: string | null;
}
