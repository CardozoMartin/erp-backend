import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TipoComprobante } from './comprobante.entity';

@Entity('numeradores_comprobante')
@Index(['sucursal_id', 'tipo'], { unique: true })
export class NumeradorComprobante {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36 })
  sucursal_id!: string;

  @Column({ type: 'enum', enum: TipoComprobante })
  tipo!: TipoComprobante;

  @Column({ type: 'int', default: 0 })
  ultimo_numero!: number;

  @Column({ type: 'varchar', length: 30 })
  prefijo!: string;

  @Column({ type: 'int', default: 6 })
  longitud!: number;

  @UpdateDateColumn()
  updated_at!: Date;
}
