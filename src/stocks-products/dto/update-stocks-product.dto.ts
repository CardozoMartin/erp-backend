import { PartialType } from '@nestjs/mapped-types';
import { CreateStocksProductDto } from './create-stocks-product.dto';

export class UpdateStocksProductDto extends PartialType(CreateStocksProductDto) {}
