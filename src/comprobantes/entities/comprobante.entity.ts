import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ComprobanteItem } from './comprobante-item.entity';

export enum TipoComprobante {
  COTIZACION = 'COTIZACION',
  VENTA = 'VENTA',
  TICKET = 'TICKET',
  FACTURA_A = 'FACTURA_A',
  FACTURA_B = 'FACTURA_B',
  FACTURA_C = 'FACTURA_C',
  REMITO = 'REMITO',
  NOTA_CREDITO = 'NOTA_CREDITO',
}

export enum EstadoComprobante {
  BORRADOR = 'BORRADOR',
  ENVIADO = 'ENVIADO',
  ACEPTADO = 'ACEPTADO',
  VENCIDO = 'VENCIDO',
  RECHAZADO = 'RECHAZADO',
  PENDIENTE_COBRO = 'PENDIENTE_COBRO',
  COBRADA = 'COBRADA',
  EMITIDO = 'EMITIDO',
  EMITIDA = 'EMITIDA',
  PENDIENTE = 'PENDIENTE',
  ENTREGADO_PARCIAL = 'ENTREGADO_PARCIAL',
  ENTREGADO = 'ENTREGADO',
  ANULADO = 'ANULADO',
  CANCELADA = 'CANCELADA',
  DEVUELTA = 'DEVUELTA',
  APLICADA = 'APLICADA',
  REEMBOLSADA = 'REEMBOLSADA',
}

@Entity('comprobantes')
export class Comprobante {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: TipoComprobante })
  tipo!: TipoComprobante;

  @Column({ type: 'enum', enum: EstadoComprobante })
  estado!: EstadoComprobante;

  @Column({ type: 'varchar', length: 40 })
  numero!: string;

  @Column({ type: 'int' })
  numero_secuencial!: number;

  @Column({ type: 'varchar', length: 4, nullable: true })
  punto_venta!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  codigo_fiscal!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  cae!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  cae_vencimiento!: Date | null;

  @Column({ type: 'varchar', length: 36 })
  sucursal_id!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  caja_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  cliente_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  empleado_vendedor_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  empleado_cajero_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  empleado_despachador_id!: string | null;

  @ManyToOne(() => Comprobante, { nullable: true })
  @JoinColumn({ name: 'comprobante_origen_id' })
  comprobanteOrigen!: Comprobante | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  comprobante_origen_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  lista_precio_id!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  descuento_global_porcentaje!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  descuento_global_monto!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  descuento_total!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  recargo_total!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total!: number;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  fecha_vencimiento!: Date | null;

  @OneToMany(() => ComprobanteItem, (item) => item.comprobante, {
    cascade: true,
  })
  items!: ComprobanteItem[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
