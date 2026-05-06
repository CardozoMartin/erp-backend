import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('categorias')
export class Categoria {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  nombre!: string;

  @Column({ nullable: true })
  descripcion!: string;

  @Column({ default: true })
  activo!: boolean;

  // ─── Auto-referencia para subcategorías ───
  @ManyToOne(() => Categoria, (categoria) => categoria.hijos, {
    nullable: true,
  })
  @JoinColumn({ name: 'padre_id' })
  padre!: Categoria;

  @Column({ nullable: true })
  padre_id!: string;

  @OneToMany(() => Categoria, (categoria) => categoria.padre)
  hijos!: Categoria[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
