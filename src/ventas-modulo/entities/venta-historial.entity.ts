import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// entities/venta-historial.entity.ts  — auditoría de estados
@Entity('venta_historial')
export class VentaHistorial {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() venta_id!: string;
  @Column({ nullable: true }) estado_anterior!: string | null;
  @Column() estado_nuevo!: string;
  @Column({ nullable: true }) usuario_id!: string;
  @Column({ nullable: true }) observacion!: string;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}
