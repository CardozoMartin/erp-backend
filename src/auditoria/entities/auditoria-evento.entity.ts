import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('auditoria_eventos')
export class AuditoriaEvento {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 60 })
  modulo!: string;

  @Column({ type: 'varchar', length: 100 })
  accion!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  entidad!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  entidad_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  empleado_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  sucursal_id!: string | null;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ type: 'json', nullable: true })
  antes!: Record<string, any> | null;

  @Column({ type: 'json', nullable: true })
  despues!: Record<string, any> | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, any> | null;

  @CreateDateColumn()
  created_at!: Date;
}
