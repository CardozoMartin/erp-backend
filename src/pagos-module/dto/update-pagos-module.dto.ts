import { PartialType } from '@nestjs/mapped-types';
import { CrearMedioPagoDto } from './create-pagos-module.dto';

export class UpdatePagosModuleDto extends PartialType(CrearMedioPagoDto) {}
