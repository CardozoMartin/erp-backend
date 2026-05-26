import { PartialType } from '@nestjs/mapped-types';
import { CrearEmpleadoDto } from './create-empleado.dto';

export class UpdateEmpleadoDto extends PartialType(CrearEmpleadoDto) {}
