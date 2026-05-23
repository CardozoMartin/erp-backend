import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoriaAtributoDto } from './create-categoria-atributo.dto';

export class UpdateCategoriaAtributoDto extends PartialType(
  CreateCategoriaAtributoDto,
) {}
