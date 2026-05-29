import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CrearEmpleadoDto } from './create-empleado.dto';

export class UpdateEmpleadoDto extends PartialType(CrearEmpleadoDto) {
  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
