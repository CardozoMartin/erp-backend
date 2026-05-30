import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { CuentaCorriente } from './cuenta-corriente.entity';

export enum TipoVencimiento {
  DIA_FIJO = 'DIA_FIJO', // vence el día X de cada mes
  DIAS_DESDE_COMPRA = 'DIAS_DESDE_COMPRA', // vence N días después de comprar
}

@Entity('planes_pago')
export class PlanPago {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => CuentaCorriente, (cc) => cc.planPago, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cuenta_corriente_id' })
  cuentaCorriente!: CuentaCorriente;

  @Column({ unique: true })
  cuenta_corriente_id!: string;

  @Column({
    type: 'enum',
    enum: TipoVencimiento,
    default: TipoVencimiento.DIAS_DESDE_COMPRA,
  })
  tipo_vencimiento!: TipoVencimiento;

  // Si tipo = DIA_FIJO: día del mes (1-31)
  // Si tipo = DIAS_DESDE_COMPRA: cantidad de días
  @Column({ type: 'int', default: 10 })
  valor_vencimiento!: number;

  // Recargo por mora
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  recargo_porcentaje_diario!: number;

  @Column({ default: true })
  recargo_activo!: boolean;
}
