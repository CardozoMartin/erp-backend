import { Sucursal } from 'src/sucursal/entities/sucursal.entity';
import { FlujoVenta } from 'src/ventas-modulo/entities/ventas-modulo.entity';
import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('config_pos_sucursal')
export class ConfigPosSucursal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Sucursal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal!: Sucursal;

  @Column({ type: 'enum', enum: FlujoVenta, default: FlujoVenta.SIMPLE })
  flujo!: FlujoVenta;

  @Column({ default: false })
  requiereDespacho!: boolean;

  @Column({ default: true })
  permiteClienteAnonimo!: boolean;

  @Column({ default: true })
  permitePagoMixto!: boolean;

  @Column({ type: 'simple-array', nullable: true })
  mediosPagoActivos!: string[]; // IDs de medios_pago habilitados

  @Column({ type: 'varchar', length: 36, nullable: true })
  listaPrecioDefaultId!: string | null;

  @UpdateDateColumn()
  updated_at!: Date;
}
