import { PartialType } from '@nestjs/mapped-types';
import { CreateAtributoVarianteDto } from './create-atributo-variante.dto';

export class UpdateAtributoVarianteDto extends PartialType(CreateAtributoVarianteDto) {}
