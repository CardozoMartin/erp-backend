import { IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateCategoriaAtributoDto {
  @IsNotEmpty()
  @IsString()
  nombre!: string;

  @IsBoolean()
  requerido?: boolean = false;

  @IsNumber()
  orden?: number = 0;
}
