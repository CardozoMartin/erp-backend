import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MovimientoCaja } from './movimiento-caja.entity';

export enum EstadoCaja {
  ABIERTA = 'ABIERTA',
  CERRADA = 'CERRADA',
}

@Entity('cajas')
export class Caja {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36 })
  sucursal_id!: string;

  @Column({ type: 'varchar', length: 36 })
  empleado_id!: string;

  @Column({ type: 'enum', enum: EstadoCaja, default: EstadoCaja.ABIERTA })
  estado!: EstadoCaja;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  monto_inicial!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  monto_final_declarado!: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  monto_final_calculado!: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  diferencia!: number | null;

  @CreateDateColumn()
  fecha_apertura!: Date;

  @Column({ type: 'timestamp', nullable: true })
  fecha_cierre!: Date | null;

  @OneToMany(() => MovimientoCaja, (movimiento) => movimiento.caja)
  movimientos!: MovimientoCaja[];

  @UpdateDateColumn()
  updated_at!: Date;
}
