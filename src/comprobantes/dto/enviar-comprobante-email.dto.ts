import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class EnviarComprobanteEmailDto {
  @IsEmail()
  @MaxLength(120)
  destino!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  asunto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  mensaje?: string;
}
