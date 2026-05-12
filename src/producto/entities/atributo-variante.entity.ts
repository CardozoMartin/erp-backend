import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Variante } from './variante.entity';

@Entity('atributos_variante')
export class AtributoVariante {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Variante, (variante) => variante.atributos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variante_id' })
  variante!: Variante;

  @Column()
  variante_id!: string;

  // ─── Tipo del atributo: 'color', 'talle', 'sabor', 'presentacion', etc. ───
  @Column({ length: 50 })
  tipo!: string;

  // ─── Valor del atributo: 'Rojo', 'XL', 'Frutilla', etc. ───
  @Column({ length: 100 })
  valor!: string;

  @Column({ type: 'text', nullable: true })
  metadata!: string | null;
}