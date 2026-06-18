import { IsDateString, IsInt, IsOptional, IsPositive, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReportePosQueryDto {
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsUUID()
  caja_id?: string;

  @IsOptional()
  @IsUUID()
  empleado_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
