// guardar-mp.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class GuardarMpDto {
  @IsString()
  @IsNotEmpty()
  sucursalId!: string;

  @IsString()
  @IsNotEmpty()
  accessToken!: string; // viene en claro, se cifra antes de guardar

  @IsString()
  @IsNotEmpty()
  mpUserId!: string;

  @IsString()
  @IsNotEmpty()
  mpPosId!: string;

  @IsString()
  mpPosNombre?: string;
}
