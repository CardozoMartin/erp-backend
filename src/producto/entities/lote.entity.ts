import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Producto } from './producto.entity';
import { Variante } from './variante.entity';

// ─── Un producto puede tener múltiples lotes, cada uno con su vencimiento ───
// Ejemplo: yogur de frutilla → lote A vence 15/08, lote B vence 01/09
// El POS despacha por FEFO (First Expired, First Out)

@Entity('lotes')
export class Lote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Producto, (producto) => producto.lotes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'producto_id' })
  producto!: Producto;

  @Column()
  producto_id!: string;

  @ManyToOne(() => Variante, (variante) => variante.lotes, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variante_id' })
  variante!: Variante;

  @Column({ nullable: true })
  variante_id!: string;

  @Column()
  sucursal_id!: string;

  // ─── Identificador del lote (puede venir del proveedor o generarse interno) ───
  @Column({ length: 100, nullable: true })
  numero_lote!: string;

  @Column({ type: 'date' })
  fecha_vencimiento!: Date;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  cantidad!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}