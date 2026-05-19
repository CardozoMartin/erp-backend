import { PartialType } from '@nestjs/mapped-types';
import { CreateMarcaProductoDto } from './create-marca_producto.dto';

export class UpdateMarcaProductoDto extends PartialType(CreateMarcaProductoDto) {}
