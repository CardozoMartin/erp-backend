import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// medio-pago.entity.ts
export enum TipoMedioPago {
  EFECTIVO = 'efectivo',
  TARJETA = 'tarjeta',
  TRANSFERENCIA = 'transferencia',
  QR = 'qr',
  OTRO = 'otro',
}

@Entity('medios_pago')
export class MedioPago {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  nombre!: string; // "Efectivo", "Tarjeta débito", "MercadoPago"

  @Column({ type: 'enum', enum: TipoMedioPago })
  tipo!: TipoMedioPago;

  @Column({ default: false })
  requiereReferencia!: boolean; // si pide nro de comprobante al cobrar

  @Column({ default: true })
  activo!: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}
