// sucursales/entities/sucursal.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum CondicionIva {
  RESPONSABLE_INSCRIPTO = 'RESPONSABLE_INSCRIPTO',
  MONOTRIBUTISTA = 'MONOTRIBUTISTA',
  EXENTO = 'EXENTO',
  CONSUMIDOR_FINAL = 'CONSUMIDOR_FINAL',
}

export enum TipoImpresora {
  TERMICA = 'TERMICA',
  FISCAL_HASAR = 'FISCAL_HASAR',
  FISCAL_EPSON = 'FISCAL_EPSON',
  PDF = 'PDF',
}

export enum AnchoTicket {
  MM_58 = '58mm',
  MM_80 = '80mm',
}

@Entity('sucursales')
export class Sucursal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  empresa_id!: string;

  // ── DATOS OPERATIVOS ──────────────────────────────
  @Column({ length: 150 })
  nombre!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nombreFantasia!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  direccion!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  localidad!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  provincia!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  codigoPostal!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email!: string | null;

  // ── DATOS FISCALES ARCA ───────────────────────────
  @Column({ type: 'varchar', length: 13, nullable: true })
  cuit!: string | null; // formato XX-XXXXXXXX-X

  @Column({ type: 'varchar', length: 200, nullable: true })
  razonSocial!: string | null;

  @Column({ type: 'enum', enum: CondicionIva, nullable: true })
  condicionIva!: CondicionIva | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  puntoVentaArca!: string | null; // ej: "0001"

  @Column({ type: 'varchar', length: 20, nullable: true })
  ingresosBrutos!: string | null;

  @Column({ type: 'date', nullable: true })
  inicioActividades!: string | null;

  // ── DATOS PARA TICKET ─────────────────────────────
  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mensajePieTicket!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  emailComprobantes!: string | null;

  @Column({ type: 'enum', enum: TipoImpresora, default: TipoImpresora.TERMICA })
  tipoImpresora!: TipoImpresora;

  @Column({ type: 'enum', enum: AnchoTicket, default: AnchoTicket.MM_80 })
  anchoTicket!: AnchoTicket;

  @Column({ default: true })
  activa!: boolean;

  @CreateDateColumn()
  creado_en!: Date;
}
