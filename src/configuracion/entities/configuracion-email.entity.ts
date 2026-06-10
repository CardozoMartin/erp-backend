import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Sucursal } from 'src/sucursal/entities/sucursal.entity';

export enum ProveedorEmail {
  GMAIL = 'GMAIL',
  SMTP = 'SMTP',
}

export enum SeguridadEmail {
  SSL = 'SSL',
  STARTTLS = 'STARTTLS',
  NINGUNA = 'NINGUNA',
}

@Entity('configuracion_email_sucursal')
export class ConfiguracionEmailSucursal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Sucursal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal!: Sucursal;

  @Column({ unique: true })
  sucursal_id!: string;

  @Column({ default: false })
  activo!: boolean;

  @Column({ type: 'enum', enum: ProveedorEmail, default: ProveedorEmail.GMAIL })
  proveedor!: ProveedorEmail;

  @Column({ type: 'varchar', length: 120 })
  email_remitente!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  nombre_remitente!: string | null;

  @Column({ type: 'varchar', length: 160 })
  usuario!: string;

  @Column({ type: 'varchar', length: 180, default: 'smtp.gmail.com' })
  smtp_host!: string;

  @Column({ type: 'int', default: 465 })
  smtp_port!: number;

  @Column({
    type: 'enum',
    enum: SeguridadEmail,
    default: SeguridadEmail.SSL,
  })
  seguridad!: SeguridadEmail;

  @Column({ type: 'text' })
  password_encriptado!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  email_respuesta!: string | null;

  @Column({ default: true })
  enviar_facturas_email!: boolean;

  @Column({ default: false })
  enviar_facturas_automaticamente!: boolean;

  @Column({ default: true })
  adjuntar_pdf!: boolean;

  @Column({ default: false })
  copia_oculta_admin!: boolean;

  @Column({ type: 'varchar', length: 120, nullable: true })
  email_copia_admin!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  ultimo_test_at!: Date | null;

  @UpdateDateColumn()
  updated_at!: Date;
}
