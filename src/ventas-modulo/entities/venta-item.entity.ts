// ventas/entities/venta-item.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VentasModulo } from './ventas-modulo.entity';

@Entity('venta_item')
export class VentaItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => VentasModulo, (v) => v.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venta_id' })
  venta!: VentasModulo;

  @Column()
  producto_id!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  variante_id!: string | null;

  @Column({ type: 'varchar', length: 255 })
  descripcion!: string; // nombre del producto al momento de la venta

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  precio_unitario!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  cantidad!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  descuento_porcentaje!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  descuento_monto!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total!: number;

  @CreateDateColumn()
  created_at!: Date;
}
