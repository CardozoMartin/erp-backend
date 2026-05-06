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
import { Producto } from './producto.entity';
import { AtributoVariante } from './atributo-variante.entity';
import { Stock } from './stock.entity';
import { Lote } from './lote.entity';
import { Imagen } from './imagen.entity';
import { Oferta } from './oferta.entity';

@Entity('variantes')
export class Variante {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Producto, (producto) => producto.variantes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'producto_id' })
  producto!: Producto;

  @Column()
  producto_id!: string;

  //SKU único por variante (ej: "REMERA-ROJA-XL")
  @Column({ length: 100, unique: true, nullable: true })
  sku!: string;

  //Precio adicional sobre el precio_base del producto
  // precio_final = producto.precio_base + variante.precio_extra
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  precio_extra!: number;

  @Column({ default: true })
  activo!: boolean;

  //Atributos dinámicos: color, talle, sabor, presentación, etc
  @OneToMany(() => AtributoVariante, (attr) => attr.variante, { cascade: true, eager: true })
  atributos!: AtributoVariante[];

  @OneToMany(() => Stock, (stock) => stock.variante)
  stock!: Stock[];

  @OneToMany(() => Lote, (lote) => lote.variante)
  lotes!: Lote[];

  @OneToMany(() => Imagen, (imagen) => imagen.variante)
  imagenes!: Imagen[];

  @OneToMany(() => Oferta, (oferta) => oferta.variante)
  ofertas!: Oferta[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}