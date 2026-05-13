import { PartialType } from '@nestjs/mapped-types';
import { CreateVentasModuloDto } from './create-ventas-modulo.dto';

export class UpdateVentasModuloDto extends PartialType(CreateVentasModuloDto) {}
