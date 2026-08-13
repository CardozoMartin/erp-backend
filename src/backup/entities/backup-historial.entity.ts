import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum EstadoBackup {
  EN_PROCESO = 'EN_PROCESO',
  EXITOSO    = 'EXITOSO',
  FALLIDO    = 'FALLIDO',
}

@Entity('backup_historial')
export class BackupHistorial {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30, default: EstadoBackup.EN_PROCESO })
  estado!: EstadoBackup;

  @Column({ type: 'varchar', length: 300, nullable: true })
  nombre_archivo!: string | null;

  // ID del archivo en Google Drive (para poder borrarlo después)
  @Column({ type: 'varchar', length: 200, nullable: true })
  drive_file_id!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  drive_link!: string | null;

  // Tamaño en bytes
  @Column({ type: 'bigint', nullable: true })
  tamano_bytes!: number | null;

  // Mensaje de error si falló
  @Column({ type: 'text', nullable: true })
  error!: string | null;

  // Manual o Automatico
  @Column({ type: 'varchar', length: 20, default: 'MANUAL' })
  origen!: 'MANUAL' | 'AUTOMATICO';

  @CreateDateColumn()
  created_at!: Date;
}
