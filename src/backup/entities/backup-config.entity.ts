import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum FrecuenciaBackup {
  DIARIO   = 'DIARIO',
  SEMANAL  = 'SEMANAL',
  MANUAL   = 'MANUAL',
}

@Entity('backup_config')
export class BackupConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Credenciales Google Drive cifradas (AES-256-GCM via CifradoService)
  @Column({ type: 'text', nullable: true })
  client_id_enc!: string | null;

  @Column({ type: 'text', nullable: true })
  client_secret_enc!: string | null;

  @Column({ type: 'text', nullable: true })
  refresh_token_enc!: string | null;

  // Configuracion
  @Column({ type: 'varchar', length: 200, nullable: true })
  carpeta_drive!: string | null;

  @Column({ type: 'varchar', length: 30, default: FrecuenciaBackup.DIARIO })
  frecuencia!: FrecuenciaBackup;

  // Hora del backup diario (0-23)
  @Column({ type: 'int', default: 3 })
  hora_backup!: number;

  // Cuántos backups conservar en Drive (los más viejos se borran)
  @Column({ type: 'int', default: 7 })
  retener_ultimos!: number;

  @Column({ default: true })
  activo!: boolean;

  @UpdateDateColumn()
  updated_at!: Date;
}
