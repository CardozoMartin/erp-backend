import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ArcaAmbiente = 'testing' | 'produccion';
export type ArcaEstado  = 'pendiente' | 'activo' | 'error';

@Entity('arca_config')
export class ArcaConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'sucursal_id' })
  sucursalId!: string;

  /** CUIT del contribuyente emisor (XX-XXXXXXXX-X) */
  @Column({ type: 'varchar', length: 13 })
  cuit!: string;

  /** Número de punto de venta dado de alta en AFIP (ej: "0001") */
  @Column({ name: 'punto_venta', type: 'varchar', length: 4 })
  puntoVenta!: string;

  /** Certificado digital (.crt) cifrado con AES-256-GCM */
  @Column({ name: 'certificado_enc', type: 'text' })
  certificadoEnc!: string;

  /** Clave privada (.key) cifrada con AES-256-GCM */
  @Column({ name: 'clave_privada_enc', type: 'text' })
  clavePrivadaEnc!: string;

  /** 'testing' apunta a wswhomo.afip.gov.ar | 'produccion' a wsaa.afip.gov.ar */
  @Column({ type: 'varchar', length: 20, default: 'testing' })
  ambiente!: ArcaAmbiente;

  @Column({ type: 'varchar', length: 20, default: 'pendiente' })
  estado!: ArcaEstado;

  /** Ticket de acceso (TA) en XML cifrado — se cachea hasta su vencimiento */
  @Column({ name: 'ticket_acceso_enc', type: 'text', nullable: true })
  ticketAccesoEnc!: string | null;

  /** Fecha/hora de vencimiento del ticket de acceso (UTC) */
  @Column({ name: 'ticket_vencimiento', type: 'datetime', nullable: true })
  ticketVencimiento!: Date | null;

  @Column({ name: 'ultimo_test', type: 'datetime', nullable: true })
  ultimoTest!: Date | null;

  @Column({ name: 'ultimo_error', type: 'text', nullable: true })
  ultimoError!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
