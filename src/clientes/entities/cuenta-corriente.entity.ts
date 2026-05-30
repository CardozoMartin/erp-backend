// clientes/entities/cuenta-corriente.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Cliente } from './cliente.entity';
import { PlanPago } from './plan-pago.entity';
import { MovimientoCuentaCorriente } from './movimiento-cuenta-corriente.entity';

@Entity('cuentas_corrientes')
export class CuentaCorriente {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Cliente, (c) => c.cuentaCorriente, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cliente_id' })
  cliente!: Cliente;

  @Column({ unique: true })
  cliente_id!: string;

  // Positivo = el cliente debe. Negativo = saldo a favor del cliente.
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  saldo!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  limite_credito!: number;

  @Column({ default: true })
  activa!: boolean;

  @OneToOne(() => PlanPago, (pp) => pp.cuentaCorriente, {
    nullable: true,
    cascade: true,
  })
  planPago!: PlanPago | null;

  @OneToMany(() => MovimientoCuentaCorriente, (m) => m.cuentaCorriente)
  movimientos!: MovimientoCuentaCorriente[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
