// ventas/entities/venta-pago.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VentasModulo } from './ventas-modulo.entity';
import { MedioPago } from 'src/pagos-module/entities/medio-pago.entity';

@Entity('venta_pago')
export class VentaPago {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => VentasModulo, (v) => v.pagos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venta_id' })
  venta!: VentasModulo;

  @ManyToOne(() => MedioPago, { eager: true })
  @JoinColumn({ name: 'medio_pago_id' })
  medioPago!: MedioPago;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monto!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  referencia!: string | null;

  @CreateDateColumn()
  created_at!: Date;
}
