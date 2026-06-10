import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Comprobante } from 'src/comprobantes/entities/comprobante.entity';
import { MedioPago } from 'src/pagos-module/entities/medio-pago.entity';

export enum TipoPagoPos {
  EFECTIVO = 'EFECTIVO',
  TARJETA_DEBITO = 'TARJETA_DEBITO',
  TARJETA_CREDITO = 'TARJETA_CREDITO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  QR = 'QR',
  CUENTA_CORRIENTE = 'CUENTA_CORRIENTE',
  SALDO_A_FAVOR = 'SALDO_A_FAVOR',
  OTRO = 'OTRO',
}

@Entity('pagos_pos')
export class PagoPos {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Comprobante, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comprobante_id' })
  comprobante!: Comprobante;

  @Column({ type: 'varchar', length: 36 })
  comprobante_id!: string;

  @ManyToOne(() => MedioPago, { eager: true, nullable: true })
  @JoinColumn({ name: 'medio_pago_id' })
  medioPago!: MedioPago | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  medio_pago_id!: string | null;

  @Column({ type: 'enum', enum: TipoPagoPos })
  tipo!: TipoPagoPos;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monto!: number;

  @Column({ type: 'int', nullable: true })
  cuotas!: number | null;

  @Column({ type: 'decimal', precision: 7, scale: 2, default: 0 })
  recargo_porcentaje!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  recargo_monto!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  referencia!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  caja_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  empleado_id!: string | null;

  @CreateDateColumn()
  created_at!: Date;
}
