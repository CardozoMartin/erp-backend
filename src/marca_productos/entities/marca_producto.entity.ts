import { Producto } from 'src/producto/entities/producto.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity('marca_productos')
export class MarcaProducto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  nombre!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo_url!: string | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @OneToMany(() => Producto, (producto) => producto.marca)
  productos!: Producto[];
}