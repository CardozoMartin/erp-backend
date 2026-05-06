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
import { Categoria } from './categoria.entity';
import { Variante } from './variante.entity';
import { Stock } from './stock.entity';
import { Lote } from './lote.entity';
import { Imagen } from './imagen.entity';
import { Oferta } from './oferta.entity';

export enum UnidadVenta {
  UNIDAD = 'UNIDAD',
  KG = 'KG',
  GRAMO = 'GRAMO',
  LITRO = 'LITRO',
  ML = 'ML',
}

@Entity('productos')
export class Producto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 200 })
  nombre!: string;

  @Column({ length: 100, unique: true, nullable: true })
  codigo_barras!: string;

  @Column({ type: 'text', nullable: true })
  descripcion!: string;

  @Column({ default: true })
  activo!: boolean;

  @Column({ default: true })
  activo_pos!: boolean;

  @Column({ default: false })
  activo_web!: boolean;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  precio_base!: number;

  @Column({ type: 'enum', enum: UnidadVenta, default: UnidadVenta.UNIDAD })
  unidad_venta!: UnidadVenta;

  @Column({ default: false })
  tiene_variantes!: boolean; 

  @Column({ default: false })
  tiene_vencimiento!: boolean; 

  @Column({ default: false })
  es_fraccionable!: boolean;

  //Relaciones
  @ManyToOne(() => Categoria, { eager: true, nullable: true })
  @JoinColumn({ name: 'categoria_id' })
  categoria!: Categoria;

  @Column({ nullable: true })
  categoria_id!: string;

  @OneToMany(() => Variante, (variante) => variante.producto, { cascade: true })
  variantes!: Variante[];

  @OneToMany(() => Stock, (stock) => stock.producto)
  stock!: Stock[];

  @OneToMany(() => Lote, (lote) => lote.producto)
  lotes!: Lote[];

  @OneToMany(() => Imagen, (imagen) => imagen.producto, { cascade: true })
  imagenes!: Imagen[];

  @OneToMany(() => Oferta, (oferta) => oferta.producto, { cascade: true })
  ofertas!: Oferta[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}