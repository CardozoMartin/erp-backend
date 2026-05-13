import { ESTADO } from "../entities/ventas-modulo.entity";

export class CreateVentasModuloDto {
    estado?: ESTADO;
    caja_id?: string;
    sucursal_id?: string;
    cliente_id?: string
    usuario_id?: string;
    notas?: string;
    items: CreateVentaItemDto[] = [];
}

export class CreateVentaItemDto {
  producto_id!: string;
  variante_id?: string;
  cantidad!: number;
  precio_unitario?: number;      // si no viene, se toma del producto
  descuento_porcentaje?: number; // 0 por defecto
}
