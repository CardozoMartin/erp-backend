import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Sucursal } from 'src/sucursal/entities/sucursal.entity';

@Entity('configuracion_cloudinary_sucursal')
export class ConfiguracionCloudinarySucursal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Sucursal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal!: Sucursal;

  @Column({ unique: true })
  sucursal_id!: string;

  @Column({ default: false })
  activo!: boolean;

  @Column({ type: 'varchar', length: 120 })
  cloud_name!: string;

  @Column({ type: 'varchar', length: 160 })
  api_key!: string;

  @Column({ type: 'text' })
  api_secret_encriptado!: string;

  @Column({ type: 'varchar', length: 180, nullable: true })
  carpeta_base!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  ultimo_test_at!: Date | null;

  @UpdateDateColumn()
  updated_at!: Date;
}
