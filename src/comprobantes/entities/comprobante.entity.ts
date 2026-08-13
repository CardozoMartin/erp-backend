import {
  AfterLoad,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { ComprobanteItem } from './comprobante-item.entity';
import { Cliente, TipoCliente } from 'src/clientes/entities/cliente.entity';
import { importeALetras } from '../utils/numero-a-letras';

// Etiquetas fiscales legibles para el comprobante impreso
const CONDICION_IVA_LABEL: Record<TipoCliente, string> = {
  [TipoCliente.CONSUMIDOR_FINAL]: 'Consumidor Final',
  [TipoCliente.RESPONSABLE_INSCRIPTO]: 'Responsable Inscripto',
  [TipoCliente.MONOTRIBUTISTA]: 'Monotributista',
  [TipoCliente.EXENTO]: 'Exento',
};

export enum TipoComprobante {
  COTIZACION = 'COTIZACION',
  VENTA = 'VENTA',
  TICKET = 'TICKET',
  FACTURA_A = 'FACTURA_A',
  FACTURA_B = 'FACTURA_B',
  FACTURA_C = 'FACTURA_C',
  REMITO = 'REMITO',
  NOTA_CREDITO = 'NOTA_CREDITO',
}

export enum EstadoComprobante {
  BORRADOR = 'BORRADOR',
  ENVIADO = 'ENVIADO',
  ACEPTADO = 'ACEPTADO',
  VENCIDO = 'VENCIDO',
  RECHAZADO = 'RECHAZADO',
  PENDIENTE_COBRO = 'PENDIENTE_COBRO',
  COBRADA = 'COBRADA',
  EMITIDO = 'EMITIDO',
  EMITIDA = 'EMITIDA',
  PENDIENTE = 'PENDIENTE',
  ENTREGADO_PARCIAL = 'ENTREGADO_PARCIAL',
  ENTREGADO = 'ENTREGADO',
  ANULADO = 'ANULADO',
  CANCELADA = 'CANCELADA',
  DEVUELTA = 'DEVUELTA',
  APLICADA = 'APLICADA',
  REEMBOLSADA = 'REEMBOLSADA',
}

const TRANSICIONES_PERMITIDAS: Partial<Record<EstadoComprobante, EstadoComprobante[]>> = {
  [EstadoComprobante.BORRADOR]:          [EstadoComprobante.ENVIADO, EstadoComprobante.ACEPTADO, EstadoComprobante.RECHAZADO, EstadoComprobante.PENDIENTE_COBRO, EstadoComprobante.VENCIDO, EstadoComprobante.CANCELADA, EstadoComprobante.ANULADO],
  [EstadoComprobante.ENVIADO]:           [EstadoComprobante.ACEPTADO, EstadoComprobante.RECHAZADO, EstadoComprobante.VENCIDO, EstadoComprobante.CANCELADA],
  [EstadoComprobante.ACEPTADO]:          [EstadoComprobante.PENDIENTE_COBRO, EstadoComprobante.VENCIDO, EstadoComprobante.CANCELADA],
  [EstadoComprobante.PENDIENTE_COBRO]:   [EstadoComprobante.COBRADA, EstadoComprobante.CANCELADA, EstadoComprobante.ANULADO],
  [EstadoComprobante.PENDIENTE]:         [EstadoComprobante.ENTREGADO_PARCIAL, EstadoComprobante.ENTREGADO, EstadoComprobante.CANCELADA],
  [EstadoComprobante.COBRADA]:           [EstadoComprobante.ENTREGADO_PARCIAL, EstadoComprobante.ENTREGADO, EstadoComprobante.EMITIDO, EstadoComprobante.EMITIDA, EstadoComprobante.ANULADO],
  [EstadoComprobante.EMITIDO]:           [EstadoComprobante.ENTREGADO_PARCIAL, EstadoComprobante.ENTREGADO, EstadoComprobante.ANULADO],
  [EstadoComprobante.EMITIDA]:           [EstadoComprobante.ENTREGADO_PARCIAL, EstadoComprobante.ENTREGADO, EstadoComprobante.APLICADA, EstadoComprobante.REEMBOLSADA, EstadoComprobante.DEVUELTA, EstadoComprobante.ANULADO],
  [EstadoComprobante.ENTREGADO_PARCIAL]: [EstadoComprobante.ENTREGADO, EstadoComprobante.ANULADO],
  // terminales sin salida: RECHAZADO, VENCIDO, CANCELADA, ANULADO, ENTREGADO, APLICADA, REEMBOLSADA, DEVUELTA
};

@Entity('comprobantes')
export class Comprobante {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: TipoComprobante })
  tipo!: TipoComprobante;

  @Column({ type: 'enum', enum: EstadoComprobante })
  estado!: EstadoComprobante;

  @Column({ type: 'varchar', length: 40 })
  numero!: string;

  @Column({ type: 'int' })
  numero_secuencial!: number;

  @Column({ type: 'varchar', length: 4, nullable: true })
  punto_venta!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  codigo_fiscal!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  cae!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  cae_vencimiento!: Date | null;

  @Column({ type: 'varchar', length: 36 })
  sucursal_id!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  caja_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  cliente_id!: string | null;

  // Solo lectura: la impresion necesita razon social, CUIT y domicilio del cliente,
  // que el comprobante no persiste. `cliente_id` sigue siendo la columna real.
  @ManyToOne(() => Cliente, { nullable: true })
  @JoinColumn({ name: 'cliente_id' })
  cliente!: Cliente | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  empleado_vendedor_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  empleado_cajero_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  empleado_despachador_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  tomada_por_cajero_id!: string | null;

  @ManyToOne(() => Comprobante, { nullable: true })
  @JoinColumn({ name: 'comprobante_origen_id' })
  comprobanteOrigen!: Comprobante | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  comprobante_origen_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  lista_precio_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  medio_pago_sugerido_id!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  descuento_global_porcentaje!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  descuento_global_monto!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  descuento_total!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  recargo_total!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total!: number;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  fecha_vencimiento!: Date | null;

  @OneToMany(() => ComprobanteItem, (item) => item.comprobante, {
    cascade: true,
  })
  items!: ComprobanteItem[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // Campo no persistido — usado por @BeforeUpdate para validar la transición de estado
  _estadoAnterior?: EstadoComprobante;

  // ── Datos del cliente aplanados para impresion ────────────────────────────
  // No son columnas: los completa @AfterLoad a partir de la relacion `cliente`.
  // Se calculan como propiedades reales (y no como getters) porque JSON.stringify
  // ignora los getters del prototipo y nunca llegarian al front.
  cliente_nombre?: string | null;
  cliente_cuit?: string | null;
  cliente_dni?: string | null;
  cliente_domicilio?: string | null;
  cliente_condicion_iva?: string | null;
  total_letras?: string;

  @AfterLoad()
  completarDatosImpresion() {
    this.total_letras = importeALetras(this.total);

    if (!this.cliente) return;
    this.cliente_nombre =
      this.cliente.razon_social ||
      [this.cliente.nombre, this.cliente.apellido].filter(Boolean).join(' ') ||
      null;
    this.cliente_cuit = this.cliente.cuit ?? null;
    this.cliente_dni = this.cliente.dni ?? null;
    this.cliente_domicilio = this.cliente.direccion ?? null;
    this.cliente_condicion_iva = CONDICION_IVA_LABEL[this.cliente.tipo] ?? null;
  }

  @BeforeUpdate()
  validarTransicionEstado() {
    if (!this._estadoAnterior || this._estadoAnterior === this.estado) return;

    const permitidos = TRANSICIONES_PERMITIDAS[this._estadoAnterior];
    if (permitidos && !permitidos.includes(this.estado)) {
      throw new BadRequestException(
        `Transición de estado inválida: ${this._estadoAnterior} → ${this.estado}`,
      );
    }
  }
}
