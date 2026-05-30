import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { CuentaCorriente } from './cuenta-corriente.entity';

export enum TipoMovimientoCC {
  CARGO = 'CARGO', // nueva deuda (venta)
  PAGO = 'PAGO', // el cliente pagó
  NOTA_CREDITO = 'NOTA_CREDITO', // devolución como saldo a favor
  RECARGO_INTERES = 'RECARGO_INTERES', // mora automática
  AJUSTE = 'AJUSTE', // corrección manual
}

@Entity('movimientos_cuenta_corriente')
export class MovimientoCuentaCorriente {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => CuentaCorriente, (cc) => cc.movimientos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cuenta_corriente_id' })
  cuentaCorriente!: CuentaCorriente;

  @Column()
  cuenta_corriente_id!: string;

  @Column({ type: 'enum', enum: TipoMovimientoCC })
  tipo!: TipoMovimientoCC;

  // Positivo = suma deuda. Negativo = reduce deuda.
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monto!: number;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  // El comprobante que originó este movimiento
  @Column({ type: 'varchar', length: 36, nullable: true })
  comprobante_id!: string | null;

  // Si el recargo fue perdonado manualmente
  @Column({ default: false })
  omitido!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  omitido_por!: string | null; // empleado_id que lo perdonó

  @CreateDateColumn()
  fecha!: Date;
}
