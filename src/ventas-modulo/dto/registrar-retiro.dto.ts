// dto/registrar-retiro.dto.ts — retiro parcial o total
export class RegistrarRetiroDto {
  items!: {
    venta_item_id: string;
    cantidad_retirada: number;   // cuánto se lleva ahora
  }[];
}