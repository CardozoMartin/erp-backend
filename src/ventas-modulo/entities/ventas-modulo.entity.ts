import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum EstadoVenta {
  // Documentos de preventa
  COTIZACION = 'COTIZACION', // presupuesto, puede convertirse en venta

  // Flujo de venta
  ABIERTA = 'ABIERTA', // carrito armándose
  PENDIENTE_PAGO = 'PENDIENTE_PAGO', // esperando cajero
  PAGADA = 'PAGADA', // cobrada
  PENDIENTE_DESPACHO = 'PENDIENTE_DESPACHO', // esperando depósito
  DESPACHADA = 'DESPACHADA', // entregada

  // Finales
  CANCELADA = 'CANCELADA',
  VENCIDA = 'VENCIDA', // cotización que expiró
}

export enum TipoDocumento {
  COTIZACION = 'COTIZACION',
  VENTA = 'VENTA',
}
@Entity('ventas_modulo')
export class VentasModulo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: EstadoVenta, default: EstadoVenta.ABIERTA })
  estado!: EstadoVenta;

  @Column({ type: 'enum', enum: FlujoVenta, default: FlujoVenta.SIMPLE })
  flujo!: FlujoVenta;

  @Column({ nullable: true })
  caja_id!: string | null;

  @Column()
  sucursal_id!: string;

  @Column({ nullable: true })
  cliente_id!: string | null;

  @Column()
  empleado_id!: string; // quien creó la venta

  @Column({ nullable: true })
  cajero_id!: string | null; // quien cobró (puede ser distinto)

  @Column({ nullable: true })
  lista_precio_id!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  descuento_total!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total!: number;

  @Column({ nullable: true })
  notas!: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at!: Date;
}
