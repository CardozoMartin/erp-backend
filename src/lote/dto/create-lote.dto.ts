import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateLoteDto {
  @IsUUID()
  producto_id!: string;

  @IsOptional()
  @IsUUID()
  variante_id?: string;

  @IsOptional()
  @Transform(({ value }) => value ?? '')
  @IsString()
  sucursal_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  numero_lote?: string;

  @Type(() => Date)
  fecha_vencimiento!: Date;

  @IsNumber()
  @Min(0)
  cantidad!: number;
}
