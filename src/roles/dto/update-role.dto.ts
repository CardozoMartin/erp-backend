import { PartialType } from '@nestjs/mapped-types';
import { CrearRoleDto } from './create-role.dto';

export class UpdateRoleDto extends PartialType(CrearRoleDto) {}
