import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Producto } from './producto.entity';
import { Variante } from './variante.entity';

// Unique por combinación: producto + variante + sucursal
// Si el producto no tiene variantes, variante_id es null
@Entity('stock')
@Unique(['producto_id', 'variante_id', 'sucursal_id'])
export class Stock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Producto, (producto) => producto.stock, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'producto_id' })
  producto!: Producto;

  @Column()
  producto_id!: string;

  //Null si el producto no tiene variantes
  @ManyToOne(() => Variante, (variante) => variante.stock, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variante_id' })
  variante!: Variante;

  @Column({ nullable: true })
  variante_id!: string | null;

  //ID de sucursal (referencia a tu tabla de sucursales)
  @Column()
  sucursal_id!: string;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  cantidad!: number; 

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  cantidad_minima!: number; 

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}