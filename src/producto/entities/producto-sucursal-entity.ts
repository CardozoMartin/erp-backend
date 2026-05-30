// productos/entities/producto-sucursal.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Producto } from './producto.entity';
import { Sucursal } from 'src/sucursal/entities/sucursal.entity';


@Entity('producto_sucursal')
@Unique(['producto', 'sucursal'])
export class ProductoSucursal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Producto, (p) => p.sucursales, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'producto_id' })
  producto!: Producto;

  @Column()
  producto_id!: string;

  @ManyToOne(() => Sucursal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal!: Sucursal;

  @Column()
  sucursal_id!: string;

  @Column({ default: true })
  activo!: boolean; // si se vende en esa sucursal

  @CreateDateColumn()
  created_at!: Date;
}
