import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GuardarConfigBackupDto {
  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @IsString()
  client_secret?: string;

  @IsOptional()
  @IsString()
  refresh_token?: string;

  @IsOptional()
  @IsString()
  carpeta_drive?: string;

  @IsOptional()
  @IsIn(['DIARIO', 'SEMANAL', 'MANUAL'])
  frecuencia?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  hora_backup?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  retener_ultimos?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
