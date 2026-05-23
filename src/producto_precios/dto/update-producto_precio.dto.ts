import { PartialType } from '@nestjs/mapped-types';
import { CreateProductoPrecioDto } from './create-producto_precio.dto';

export class UpdateProductoPrecioDto extends PartialType(
  CreateProductoPrecioDto,
) {}
