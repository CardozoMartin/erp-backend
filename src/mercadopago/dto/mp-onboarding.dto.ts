import { IsBoolean, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class MpAccessTokenDto {
  @IsString()
  @IsNotEmpty()
  accessToken!: string;
}

export class CrearMpStoreDto extends MpAccessTokenDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  externalId!: string;

  @IsObject()
  location!: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  businessHours?: Record<string, unknown>;
}

export class CrearMpPosDto extends MpAccessTokenDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsBoolean()
  fixedAmount!: boolean;

  @IsString()
  @IsNotEmpty()
  storeId!: string;

  @IsString()
  @IsNotEmpty()
  externalStoreId!: string;

  @IsString()
  @IsNotEmpty()
  externalId!: string;

  @IsNumber()
  category!: number;
}

export class BuscarMpPosDto extends MpAccessTokenDto {
  @IsString()
  @IsNotEmpty()
  externalId!: string;
}

export class BuscarMpStoreDto extends MpAccessTokenDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  externalId!: string;
}
