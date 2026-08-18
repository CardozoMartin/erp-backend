import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Sucursal } from 'src/sucursal/entities/sucursal.entity';

export enum ModoPOS {
  SIMPLE = 'SIMPLE',
  MULTICAJA = 'MULTICAJA',
  CAJA_CENTRALIZADA = 'CAJA_CENTRALIZADA',
  CON_DESPACHO = 'CON_DESPACHO',
}

export enum DescuentoStock {
  AL_COBRAR = 'AL_COBRAR',
  AL_DESPACHAR = 'AL_DESPACHAR',
}

export enum FormatoImpresionComprobante {
  TICKET_80MM = 'TICKET_80MM',
  TICKET_58MM = 'TICKET_58MM',
  BOLETA_A4 = 'BOLETA_A4',
}

export enum DisenoComprobante {
  BASICO = 'BASICO',
  WAVE = 'WAVE',
  CLASICO = 'CLASICO',
}

@Entity('configuracion_sucursal')
export class ConfiguracionSucursal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Sucursal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal!: Sucursal;

  @Column({ unique: true })
  sucursal_id!: string;

  //Cotizaciones
  @Column({ type: 'int', default: 24 })
  cotizacion_vigencia_horas!: number;

  //Punto de venta
  @Column({ type: 'varchar', length: 30, default: ModoPOS.SIMPLE })
  modo_pos!: ModoPOS;

  @Column({ type: 'varchar', length: 30, default: DescuentoStock.AL_COBRAR })
  descuento_stock!: DescuentoStock;

  @Column({ default: true })
  permitir_pago_mixto!: boolean;

  @Column({ default: false })
  permitir_listas_precio!: boolean;

  @Column({ default: false })
  permitir_cotizaciones!: boolean;

  //Prefijos de numeración
  @Column({ type: 'varchar', length: 20, default: 'TKT' })
  prefijo_ticket!: string;

  @Column({ type: 'varchar', length: 20, default: 'PRE' })
  prefijo_cotizacion!: string;

  @Column({ type: 'varchar', length: 20, default: 'REM' })
  prefijo_remito!: string;

  @Column({ type: 'varchar', length: 20, default: 'NCA' })
  prefijo_nota_credito!: string;

  // -- ARCA / Facturación
  @Column({ type: 'varchar', length: 4, nullable: true })
  punto_venta_arca!: string | null;

  // -- Cuenta corriente
  @Column({ default: false })
  permitir_cuenta_corriente!: boolean;

  // -- Envios a domicilio
  // Apaga todo el circuito de pedidos con envio: sin esto la sucursal no muestra
  // el boton en el POS ni acepta creacion de pedidos por API.
  @Column({ default: false })
  permitir_envios!: boolean;

  // -- Impresion de comprobantes
  @Column({ type: 'varchar', length: 30, default: FormatoImpresionComprobante.TICKET_80MM })
  formato_impresion_comprobante!: FormatoImpresionComprobante;

  @Column({ default: false })
  imprimir_automaticamente!: boolean;

  @Column({ type: 'varchar', length: 30, default: DisenoComprobante.BASICO })
  diseno_comprobante!: DisenoComprobante;

  @Column({ type: 'varchar', length: 120, nullable: true })
  nombre_fantasia_ticket!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  razon_social_ticket!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cuit_ticket!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  ingresos_brutos_ticket!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  inicio_actividades_ticket!: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  domicilio_ticket!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  telefono_ticket!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  email_ticket!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  web_ticket!: string | null;

  @Column({ type: 'varchar', length: 400, nullable: true })
  mensaje_ticket!: string | null;

  @Column({ type: 'varchar', length: 400, nullable: true })
  mensaje_boleta!: string | null;

  @Column({ default: true })
  mostrar_detalle_productos!: boolean;

  @Column({ default: true })
  mostrar_descuentos!: boolean;

  @Column({ default: true })
  mostrar_recargos!: boolean;

  @Column({ default: true })
  mostrar_observaciones!: boolean;

  @Column({ default: true })
  mostrar_datos_fiscales!: boolean;

  // -- Stock inter-sucursal
  @Column({ default: false })
  consulta_stock_otras_sucursales!: boolean;

  @UpdateDateColumn()
  updated_at!: Date;
}
