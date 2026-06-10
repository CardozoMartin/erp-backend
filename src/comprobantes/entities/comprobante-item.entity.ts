import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Comprobante } from './comprobante.entity';

@Entity('comprobante_items')
export class ComprobanteItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Comprobante, (comprobante) => comprobante.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'comprobante_id' })
  comprobante!: Comprobante;

  @Column({ type: 'varchar', length: 36 })
  comprobante_id!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  producto_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  variante_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  comprobante_item_origen_id!: string | null;

  @Column({ type: 'varchar', length: 255 })
  descripcion!: string;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  cantidad!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  precio_unitario!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  descuento_porcentaje!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  descuento_monto!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  recargo_monto!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal!: number;

  @CreateDateColumn()
  created_at!: Date;
}
