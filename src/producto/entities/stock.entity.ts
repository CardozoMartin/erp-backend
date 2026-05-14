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
import { Producto } from './producto.entity';
import { Variante } from './variante.entity';

// El stock puede ser general (sucursal_id null) o estar asociado a una sucursal.
// Si el producto no tiene variantes, variante_id es null
@Entity('stock')
@Unique('IDX_eee338f574fa6f71766a4c5e94', [
  
 
 ,

  'producto_id',
  'variante_id',
  'sucursal_id',
])
export class Stock {
   ,
 
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Producto, (producto) => producto.stock, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'producto_id' })
  producto!: Producto;
   
   ,
 

  @Column()
  producto_id!: string;

  //Null si el producto no tiene variantes
  @ManyToOne(() => Variante, (variante) => variante.stock, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'variante_id' })
  variante!: Variante;

  @Index('IDX_stock_variante_id')
  @Column({ nullable: true })
  variante_id!: string | null;

  //ID de sucursal (referencia a tu tabla de sucursales)
  @Column({ type: 'varchar', length: 255, nullable: true })
  sucursal_id!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  cantidad!: number;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  cantidad_minima!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
