import { IsDateString, IsOptional, IsUUID } from 'class-validator';

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
}
