import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductoCategoria } from './producto-categoria.entity';

@Entity('categoria_atributo_def')
export class CategoriaAtributoDef {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ProductoCategoria, (categoria) => categoria.atributos, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'categoria_id' })
  categoria!: ProductoCategoria;

  @Column()
  categoria_id!: string;

  @Column({ length: 100 })
  nombre!: string;

  @Column({ default: false })
  requerido!: boolean;

  @Column({ default: 0 })
  orden!: number;
}
