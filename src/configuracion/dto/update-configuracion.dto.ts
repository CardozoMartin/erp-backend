import { PartialType } from '@nestjs/mapped-types';
import { CreateConfiguracionDto } from './create-configuracion.dto';

export class UpdateConfiguracionDto extends PartialType(
  CreateConfiguracionDto,
) {}
