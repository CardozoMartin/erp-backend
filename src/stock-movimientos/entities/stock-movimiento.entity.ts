import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum TipoMovimientoStock {
  ENTRADA = 'ENTRADA',
  SALIDA = 'SALIDA',
  AJUSTE = 'AJUSTE',
  DEVOLUCION = 'DEVOLUCION',
  GARANTIA = 'GARANTIA',
  DESPACHO = 'DESPACHO',
}

export enum OrigenMovimientoStock {
  MANUAL = 'MANUAL',
  COMPROBANTE = 'COMPROBANTE',
  DESPACHO = 'DESPACHO',
  DEVOLUCION = 'DEVOLUCION',
  GARANTIA = 'GARANTIA',
  CONSUMO_INTERNO = 'CONSUMO_INTERNO',
}

@Entity('stock_movimientos')
export class StockMovimiento {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: TipoMovimientoStock })
  tipo!: TipoMovimientoStock;

  @Column({ type: 'enum', enum: OrigenMovimientoStock })
  origen!: OrigenMovimientoStock;

  @Column({ type: 'varchar', length: 36 })
  producto_id!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  variante_id!: string | null;

  @Column({ type: 'varchar', length: 36 })
  sucursal_id!: string;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  cantidad!: number;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  cantidad_anterior!: number;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  cantidad_nueva!: number;

  @Column({ type: 'varchar', length: 36, nullable: true })
  comprobante_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  despacho_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  empleado_id!: string | null;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @CreateDateColumn()
  created_at!: Date;
}
