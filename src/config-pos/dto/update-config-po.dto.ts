import { PartialType } from '@nestjs/mapped-types';
import { ConfigPosDto } from './create-config-po.dto';

export class UpdateConfigPoDto extends PartialType(ConfigPosDto) {}
