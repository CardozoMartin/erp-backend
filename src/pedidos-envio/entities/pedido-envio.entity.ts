import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Comprobante } from 'src/comprobantes/entities/comprobante.entity';

export enum EstadoPedidoEnvio {
  PENDIENTE = 'PENDIENTE',
  PREPARANDO = 'PREPARANDO',
  EN_CAMINO = 'EN_CAMINO',
  ENTREGADO = 'ENTREGADO',
  CANCELADO = 'CANCELADO',
}

export enum EstadoPagoPedidoEnvio {
  PENDIENTE_PAGO = 'PENDIENTE_PAGO',
  PAGADO = 'PAGADO',
  PENDIENTE_RENDICION = 'PENDIENTE_RENDICION',
  RENDIDO = 'RENDIDO',
}

export enum MedioPagoPedidoEnvio {
  EFECTIVO = 'EFECTIVO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  OTRO = 'OTRO',
}

@Entity('pedidos_envio')
export class PedidoEnvio {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: EstadoPedidoEnvio, default: EstadoPedidoEnvio.PENDIENTE })
  estado!: EstadoPedidoEnvio;

  @Column({ type: 'enum', enum: EstadoPagoPedidoEnvio, default: EstadoPagoPedidoEnvio.PENDIENTE_PAGO })
  estado_pago!: EstadoPagoPedidoEnvio;

  @Column({ type: 'enum', enum: MedioPagoPedidoEnvio })
  medio_pago_previsto!: MedioPagoPedidoEnvio;

  @ManyToOne(() => Comprobante, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'comprobante_id' })
  comprobante!: Comprobante;

  @Column({ type: 'varchar', length: 36 })
  comprobante_id!: string;

  @Column({ type: 'varchar', length: 36 })
  sucursal_id!: string;

  @Column({ type: 'varchar', length: 36 })
  cliente_id!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  empleado_repartidor_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  empleado_rendicion_id!: string | null;

  @Column({ type: 'varchar', length: 180 })
  direccion_entrega!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  localidad_entrega!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  barrio_entrega!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  codigo_postal_entrega!: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  telefono_contacto!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  referencia_entrega!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  fecha_programada!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  fecha_entrega!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  fecha_rendicion!: Date | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  monto_rendido!: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  referencia_pago!: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
