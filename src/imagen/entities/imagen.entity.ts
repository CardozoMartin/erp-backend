import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Producto } from '../../producto/entities/producto.entity';
import { Variante } from '../../variante/entities/variante.entity';

export enum RolImagen {
  PRINCIPAL = 'PRINCIPAL',
  GALERIA   = 'GALERIA',
  DETALLE   = 'DETALLE',
  BANNER    = 'BANNER',
  MINIATURA = 'MINIATURA',
}

@Entity('imagenes')
export class Imagen {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  //Relación con producto
  @ManyToOne(() => Producto, (producto) => producto.imagenes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'producto_id' })
  producto!: Producto;

  @Column()
  producto_id!: string;

  //Relación con variante (opcional) 
  // null  → imagen aplica al producto general
  // valor → imagen específica de esa variante (ej: foto del color Rojo)
  @ManyToOne(() => Variante, (variante) => variante.imagenes, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'variante_id' })
  variante!: Variante | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  variante_id!: string | null;

  //Rol semántico de la imagen
  @Column({ type: 'enum', enum: RolImagen, default: RolImagen.GALERIA })
  rol!: RolImagen;

  @Column({ length: 500 })
  url!: string;

  //Metadatos opcionales
  @Column({ type: 'varchar', length: 255, nullable: true })
  storage_key!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  alt_text!: string | null;

  //Orden dentro del mismo rol
  @Column({ default: 0 })
  orden!: number;

  //Dimensiones (útil para evitar layout shift en el frontend)
  @Column({ type: 'int', nullable: true })
  ancho_px!: number | null;

  @Column({ type: 'int', nullable: true })
  alto_px!: number | null;

  @CreateDateColumn()
  created_at!: Date;
}