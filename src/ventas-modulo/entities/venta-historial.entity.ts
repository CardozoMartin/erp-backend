// ventas/entities/venta-historial.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VentasModulo } from './ventas-modulo.entity';
import { EstadoVenta } from '../enum/estado-venta.enum';

@Entity('venta_historial')
export class VentaHistorial {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => VentasModulo, (v) => v.historial, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venta_id' })
  venta!: VentasModulo;

  @Column({ type: 'enum', enum: EstadoVenta })
  estado_anterior!: EstadoVenta;

  @Column({ type: 'enum', enum: EstadoVenta })
  estado_nuevo!: EstadoVenta;

  @Column({ type: 'varchar', length: 36 })
  usuario_id!: string;

  @Column({ type: 'text', nullable: true })
  observacion!: string | null;

  @CreateDateColumn()
  created_at!: Date;
}
