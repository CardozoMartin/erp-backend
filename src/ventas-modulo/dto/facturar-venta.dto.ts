// dto/facturar-venta.dto.ts
export class FacturarVentaDto {
  numero_comprobante?: string;
  tipo_comprobante!:'A' | 'B' | 'C' | 'X';
  condicion_pago!: 'CONTADO' | 'CUENTA_CORRIENTE';
}