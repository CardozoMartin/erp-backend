import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Caja } from './caja.entity';

export enum TipoMovimientoCaja {
  APERTURA = 'APERTURA',
  COBRO = 'COBRO',
  INGRESO_MANUAL = 'INGRESO_MANUAL',
  EGRESO = 'EGRESO',
  AJUSTE = 'AJUSTE',
  CIERRE = 'CIERRE',
}

export enum CategoriaMovimientoCaja {
  RETIRO_DINERO = 'RETIRO_DINERO',
  PAGO_PROVEEDOR = 'PAGO_PROVEEDOR',
  PAGO_EMPLEADO = 'PAGO_EMPLEADO',
  COMPRA_LOCAL = 'COMPRA_LOCAL',
  CONSUMO_INTERNO = 'CONSUMO_INTERNO',
  OTRO = 'OTRO',
}

@Entity('movimientos_caja')
export class MovimientoCaja {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Caja, (caja) => caja.movimientos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caja_id' })
  caja!: Caja;

  @Column({ type: 'varchar', length: 36 })
  caja_id!: string;

  @Column({ type: 'enum', enum: TipoMovimientoCaja })
  tipo!: TipoMovimientoCaja;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monto!: number;

  @Column({ type: 'varchar', length: 36, nullable: true })
  empleado_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  comprobante_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  medio_pago_id!: string | null;

  @Column({ type: 'enum', enum: CategoriaMovimientoCaja, nullable: true })
  categoria_egreso!: CategoriaMovimientoCaja | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  entidad_nombre!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  referencia!: string | null;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @CreateDateColumn()
  fecha!: Date;
}
