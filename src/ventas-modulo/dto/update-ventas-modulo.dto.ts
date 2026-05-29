import { PartialType } from '@nestjs/mapped-types';
import { CrearVentaDto } from './create-ventas-modulo.dto';

export class UpdateVentasModuloDto extends PartialType(CrearVentaDto) {}
