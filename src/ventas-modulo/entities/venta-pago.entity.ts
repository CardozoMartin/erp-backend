import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

// entities/venta-pago.entity.ts
@Entity('venta_pago')
export class VentaPago {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() venta_id!: string;
  @Column() medio_pago!: string;        
  @Column({ type: 'decimal', precision: 12, scale: 2 }) monto!: number;
  @Column({ nullable: true }) referencia!: string;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}