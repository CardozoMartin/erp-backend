import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';
import { Empleado } from 'src/empleados/entities/empleado.entity';

@Entity('sesiones_activas')
export class SesionActiva {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  refresh_token!: string;

  @Column({ type: 'varchar', length: 36 })
  empleado_id!: string;

  @ManyToOne(() => Empleado, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'empleado_id' })
  empleado!: Empleado;

  @Column({ type: 'varchar', length: 36, nullable: true })
  sucursal_id!: string | null;

  @Column({ type: 'timestamp' })
  expira_en!: Date;

  @Column({ default: false })
  revocado!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
