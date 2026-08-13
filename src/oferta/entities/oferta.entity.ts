import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Producto } from '../../producto/entities/producto.entity';
import { Variante } from '../../variante/entities/variante.entity';

@Entity('ofertas')
export class Oferta {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Producto, (producto) => producto.ofertas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'producto_id' })
  producto!: Producto;

  @Column()
  producto_id!: string;

  // ─── Null → oferta aplica a todo el producto. Con valor → solo a esa variante ───
  @ManyToOne(() => Variante, (variante) => variante.ofertas, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variante_id' })
  variante!: Variante;

  @Column({ type: 'varchar', length: 36, nullable: true })
  variante_id!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  precio_oferta!: number;

  @Column({ type: 'timestamp' })
  fecha_inicio!: Date;

  @Column({ type: 'timestamp' })
  fecha_fin!: Date;

  @Column({ default: true })
  activo!: boolean;

  // null = sin límite de unidades; > 0 = la oferta se agota al venderse esa cantidad
  @Column({ type: 'int', nullable: true, default: null })
  cantidad_maxima!: number | null;

  @Column({ type: 'int', default: 0 })
  cantidad_vendida!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
