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
import { Comprobante } from 'src/comprobantes/entities/comprobante.entity';
import { DespachoItem } from './despacho-item.entity';

export enum EstadoDespacho {
  PENDIENTE = 'PENDIENTE',
  ENTREGADO_PARCIAL = 'ENTREGADO_PARCIAL',
  ENTREGADO = 'ENTREGADO',
  ANULADO = 'ANULADO',
}

@Entity('despachos')
export class Despacho {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: EstadoDespacho, default: EstadoDespacho.PENDIENTE })
  estado!: EstadoDespacho;

  @ManyToOne(() => Comprobante, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comprobante_id' })
  comprobante!: Comprobante;

  @Column({ type: 'varchar', length: 36 })
  comprobante_id!: string;

  @ManyToOne(() => Comprobante, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'remito_id' })
  remito!: Comprobante | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  remito_id!: string | null;

  @Column({ type: 'varchar', length: 36 })
  sucursal_id!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  empleado_despachador_id!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  fecha_despacho!: Date | null;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;

  @OneToMany(() => DespachoItem, (item) => item.despacho, { cascade: true })
  items!: DespachoItem[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
