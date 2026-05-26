// ventas/entities/ventas-modulo.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { VentaItem } from './venta-item.entity';
import { VentaPago } from './venta-pago.entity';
import { VentaHistorial } from './venta-historial.entity';
import { TipoDocumento } from '../enum/tipo-documento.enum';
import { EstadoVenta } from '../enum/estado-venta.enum';
import { FlujoVenta } from '../enum/flujo-venta.enum';
export { FlujoVenta } from '../enum/flujo-venta.enum';

@Entity('ventas_modulo')
export class VentasModulo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: TipoDocumento, default: TipoDocumento.VENTA })
  tipoDocumento!: TipoDocumento;

  @Column({ type: 'enum', enum: EstadoVenta, default: EstadoVenta.ABIERTA })
  estado!: EstadoVenta;

  @Column({ type: 'enum', enum: FlujoVenta, default: FlujoVenta.SIMPLE })
  flujo!: FlujoVenta;

  @Column({ type: 'varchar', length: 36 })
  sucursal_id!: string;

  @Column({ type: 'varchar', length: 36 })
  empleado_id!: string; // quien creó la venta

  @Column({ type: 'varchar', length: 36, nullable: true })
  cajero_id!: string | null; // quien cobró

  @Column({ type: 'varchar', length: 36, nullable: true })
  cliente_id!: string | null; // cliente opcional

  @Column({ type: 'varchar', length: 36, nullable: true })
  caja_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  lista_precio_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  cotizacion_origen_id!: string | null; // si viene de una cotización

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  descuento_total!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total!: number;

  @Column({ type: 'text', nullable: true })
  notas!: string | null;

  @OneToMany(() => VentaItem, (item) => item.venta, { cascade: true })
  items!: VentaItem[];

  @OneToMany(() => VentaPago, (pago) => pago.venta, { cascade: true })
  pagos!: VentaPago[];

  @OneToMany(() => VentaHistorial, (h) => h.venta, { cascade: true })
  historial!: VentaHistorial[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
