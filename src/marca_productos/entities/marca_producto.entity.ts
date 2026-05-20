import { Producto } from 'src/producto/entities/producto.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity('marca_productos')
export class MarcaProducto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  nombre!: string;

  @Column({ nullable: true })
  descripcion!: string;

  @Column({ nullable: true })
  logo_url!: string;

  @Column({ default: true })
  activo!: boolean;

  @OneToMany(() => Producto, (producto) => producto.marca)
  productos!: Producto[];

}
