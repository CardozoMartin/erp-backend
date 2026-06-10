import { OmitType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateComprobanteDto } from 'src/comprobantes/dto/create-comprobante.dto';

export class CreateCotizacionDto extends OmitType(CreateComprobanteDto, [
  'tipo',
] as const) {}

export class CambiarEstadoCotizacionDto {
  @IsOptional()
  @IsString()
  observaciones?: string | null;
}

export class ConvertirCotizacionDto {
  @IsOptional()
  @IsString()
  observaciones?: string | null;
}
