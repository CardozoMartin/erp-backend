import { PartialType } from '@nestjs/mapped-types';
import { CreateRetirosModuleDto } from './create-retiros-module.dto';

export class UpdateRetirosModuleDto extends PartialType(CreateRetirosModuleDto) {}
