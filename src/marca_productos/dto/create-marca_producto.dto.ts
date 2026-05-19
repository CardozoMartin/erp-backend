import { IsBoolean, IsString } from "class-validator";

export class CreateMarcaProductoDto {

    @IsString()
    nombre!: string;

    @IsString()
    descripcion!: string;

    @IsString()
    logo_url!: string;

    @IsBoolean()
    activo!: boolean;
}
