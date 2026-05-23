import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { Producto } from '../../producto/entities/producto.entity';
import { Variante } from '../../variante/entities/variante.entity';
import { Sucursal } from '../../sucursal/entities/sucursal.entity';

const decimalNumberTransformer = {
  to: (value?: number | string | null) =>
    value === undefined || value === null ? value : Number(value),
  from: (value?: string | number | null) =>
    value === undefined || value === null ? value : Number(value),
};

// sucursal_id null = stock general (sin sucursal específica)
// variante_id null = stock del producto sin variantes
@Entity('stock')
@Unique('UQ_stock_producto_variante_sucursal', [
  'producto_id',
  'variante_id',
  'sucursal_id',
])
export class Stock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  //Producto ──────────────────────────────────────────────────────────────
  @ManyToOne(() => Producto, (producto) => producto.stock, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'producto_id' })
  producto!: Producto;

  @Column()
  producto_id!: string;

  //Variante (null si el producto no tiene variantes) ─────────────────────
  @ManyToOne(() => Variante, (variante) => variante.stock, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'variante_id' })
  variante!: Variante | null;

  @Index('IDX_stock_variante_id')
  @Column({ nullable: true })
  variante_id!: string | null;

  // Sucursal (null = stock general compartido entre sucursales) ───────────
  // FK real: garantiza integridad referencial a nivel de base de datos.
  // Si se elimina la sucursal, el stock queda con sucursal_id = null
  // (SET NULL) en lugar de borrarse, para no perder el historial.
  @ManyToOne(() => Sucursal, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: false,
  })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal!: Sucursal | null;

  @Index('IDX_stock_sucursal_id')
  @Column({ type: 'uuid', nullable: true })
  sucursal_id!: string | null;

  // Cantidades ────────────────────────────────────────────────────────────
  // Soporta decimales para productos fraccionables (ej: 1.5 kg)
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 3,
    default: 0,
    transformer: decimalNumberTransformer,
  })
  cantidad!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 3,
    default: 0,
    transformer: decimalNumberTransformer,
  })
  cantidad_minima!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
