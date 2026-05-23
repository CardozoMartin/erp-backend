import { PartialType } from '@nestjs/mapped-types';
import { CreatePagosModuleDto } from './create-pagos-module.dto';

export class UpdatePagosModuleDto extends PartialType(CreatePagosModuleDto) {}
