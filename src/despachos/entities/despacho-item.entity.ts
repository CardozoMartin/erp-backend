import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ComprobanteItem } from 'src/comprobantes/entities/comprobante-item.entity';
import { Despacho } from './despacho.entity';

export enum MotivoPendienteDespacho {
  RETIRA_LUEGO = 'RETIRA_LUEGO',
  SIN_STOCK = 'SIN_STOCK',
  EN_GARANTIA = 'EN_GARANTIA',
  OTRO = 'OTRO',
}

@Entity('despacho_items')
export class DespachoItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Despacho, (despacho) => despacho.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'despacho_id' })
  despacho!: Despacho;

  @Column({ type: 'varchar', length: 36 })
  despacho_id!: string;

  @ManyToOne(() => ComprobanteItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comprobante_item_id' })
  comprobanteItem!: ComprobanteItem;

  @Column({ type: 'varchar', length: 36 })
  comprobante_item_id!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  producto_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  variante_id!: string | null;

  @Column({ type: 'varchar', length: 255 })
  descripcion!: string;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  cantidad_solicitada!: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  cantidad_despachada!: number;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  cantidad_pendiente!: number;

  @Column({
    type: 'enum',
    enum: MotivoPendienteDespacho,
    nullable: true,
  })
  motivo_pendiente!: MotivoPendienteDespacho | null;

  @CreateDateColumn()
  created_at!: Date;
}
