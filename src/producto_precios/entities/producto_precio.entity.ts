import { Producto } from 'src/producto/entities/producto.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('producto_precios')
export class ProductoPrecio {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Producto, (producto) => producto.precios, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'producto_id' })
  producto!: Producto;

  @Column()
  producto_id!: string;

  // nullable = precio general (aplica a todas las sucursales)
  @Column({ type: 'varchar', nullable: true })
  sucursal_id!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  precio!: number;

  @Column({ type: 'varchar', length: 10, default: 'ARS' })
  moneda!: string;

  @Column({ type: 'date' })
  vigente_desde!: Date;

  @CreateDateColumn()
  created_at!: Date;
}
