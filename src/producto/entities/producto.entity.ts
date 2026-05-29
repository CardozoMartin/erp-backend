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
import { ProductoCategoria } from '../../producto-categoria/entities/producto-categoria.entity';
import { Variante } from '../../variante/entities/variante.entity';
import { Stock } from '../../stock/entities/stock.entity';
import { Lote } from '../../lote/entities/lote.entity';
import { Imagen } from '../../imagen/entities/imagen.entity';
import { Oferta } from '../../oferta/entities/oferta.entity';
import { AtributoProducto } from '../../atributo-producto/entities/atributo-producto.entity';
import { ProductoPrecio } from 'src/producto_precios/entities/producto_precio.entity';
import { MarcaProducto } from 'src/marca_productos/entities/marca_producto.entity';

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

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  codigo_barras!: string | null;

  @Column({ type: 'text', nullable: true })
  descripcion!: string;

  @Column({ default: true })
  activo!: boolean;

  @Column({ default: true })
  activo_pos!: boolean;

  @Column({ default: false })
  activo_web!: boolean;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  precio_base!: number;

  @OneToMany(() => ProductoPrecio, (precio) => precio.producto)
  precios!: ProductoPrecio[];

  @Column({ type: 'enum', enum: UnidadVenta, default: UnidadVenta.UNIDAD })
  unidad_venta!: UnidadVenta;

  @Column({ default: false })
  tiene_variantes!: boolean;

  @Column({ default: false })
  tiene_vencimiento!: boolean;

  @Column({ default: false })
  es_fraccionable!: boolean;

  //Relaciones
  @ManyToOne(() => ProductoCategoria, { eager: true, nullable: true })
  @JoinColumn({ name: 'categoria_id' })
  categoria!: ProductoCategoria | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  categoria_id!: string | null;

  @OneToMany(() => Variante, (variante) => variante.producto, { cascade: true })
  variantes!: Variante[];

  @OneToMany(() => AtributoProducto, (atributo) => atributo.producto, {
    cascade: true,
  })
  atributos!: AtributoProducto[];

  @OneToMany(() => Stock, (stock) => stock.producto)
  stock!: Stock[];

  @OneToMany(() => Lote, (lote) => lote.producto)
  lotes!: Lote[];

  @OneToMany(() => Imagen, (imagen) => imagen.producto, { cascade: true })
  imagenes!: Imagen[];

  @OneToMany(() => Oferta, (oferta) => oferta.producto, { cascade: true })
  ofertas!: Oferta[];

  //marca Productos
  @ManyToOne(() => MarcaProducto, (marca) => marca.productos, {
    eager: true,
    nullable: true,
  })
  @JoinColumn({ name: 'marca_id' })
  marca!: MarcaProducto | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  marca_id!: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
