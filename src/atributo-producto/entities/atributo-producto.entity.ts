import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Producto } from '../../producto/entities/producto.entity';

@Entity('atributos_producto')
export class AtributoProducto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Producto, (producto) => producto.atributos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'producto_id' })
  producto!: Producto;

  @Column()
  producto_id!: string;

  // ─── Tipo del atributo: 'color', 'talle', 'sabor', 'presentacion', etc. ───
  @Column({ length: 50 })
  tipo!: string;

  // ─── Valor del atributo: 'Rojo', 'XL', 'Frutilla', etc. ───
  @Column({ length: 100 })
  valor!: string;

  @Column({ type: 'text', nullable: true })
  metadata!: string | null;
}
