// lista-precio/entities/lista-precio.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TipoAjustePrecio {
  DESCUENTO = 'DESCUENTO',
  RECARGO = 'RECARGO',
}

export enum TipoListaPrecio {
  CONTADO = 'CONTADO',
  TARJETA = 'TARJETA',
  MAYORISTA = 'MAYORISTA',
  PROMOCION = 'PROMOCION',
  PERSONALIZADA = 'PERSONALIZADA',
}

export enum ModoIvaListaPrecio {
  NO_APLICA = 'NO_APLICA',
  IVA_INCLUIDO = 'IVA_INCLUIDO',
  AGREGAR_IVA = 'AGREGAR_IVA',
}

@Entity('listas_precio')
export class ListaPrecio {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  nombre!: string; // "Contado efectivo", "Tarjeta 6 cuotas", "Mayorista"

  @Column({ type: 'varchar', length: 36, nullable: true })
  sucursal_id!: string | null; // null = aplica a todas las sucursales

  @Column({ type: 'enum', enum: TipoListaPrecio, default: TipoListaPrecio.PERSONALIZADA })
  tipo_lista!: TipoListaPrecio;

  @Column({ type: 'enum', enum: TipoAjustePrecio })
  tipo_ajuste!: TipoAjustePrecio;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  porcentaje!: number; // 10.00 = 10%

  // Solo para listas de tarjeta crédito
  @Column({ type: 'int', nullable: true })
  cuotas!: number | null;

  @Column({ type: 'enum', enum: ModoIvaListaPrecio, default: ModoIvaListaPrecio.NO_APLICA })
  modo_iva!: ModoIvaListaPrecio;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 21 })
  porcentaje_iva!: number;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ default: true })
  activa!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
