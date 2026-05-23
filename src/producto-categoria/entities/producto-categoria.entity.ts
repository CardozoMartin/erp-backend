import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CategoriaAtributoDef } from './categoria-atributoDef';

@Entity('producto_categorias')
export class ProductoCategoria {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  nombre!: string;

  @Column({ nullable: true })
  descripcion!: string;

  @Column({ nullable: true })
  color_identificador!: string;

  @Column({ default: true })
  activo!: boolean;

  // ─── Auto-referencia para subcategorías ───
  @ManyToOne(() => ProductoCategoria, (categoria) => categoria.hijos, {
    nullable: true,
  })
  @JoinColumn({ name: 'padre_id' })
  padre!: ProductoCategoria | null;

  @Column({ nullable: true })
  padre_id!: string | null;

  @OneToMany(() => ProductoCategoria, (categoria) => categoria.padre)
  hijos!: ProductoCategoria[];

  //Relacion con atributos de categoria
  @OneToMany(() => CategoriaAtributoDef, (atributo) => atributo.categoria)
  atributos!: CategoriaAtributoDef[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
