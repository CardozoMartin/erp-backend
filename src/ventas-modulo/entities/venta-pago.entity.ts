import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// venta-pago.entity.ts
@Entity('venta_pago')
export class VentaPago {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  venta_id!: string;

  @Column()
  medio_pago_id!: string; // ← FK a medios_pago (no string libre)

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monto!: number;

  @Column({ nullable: true })
  referencia!: string | null; // nro transferencia, comprobante, etc

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}
