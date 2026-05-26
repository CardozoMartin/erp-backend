// empleados/entities/empleado-permiso.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Empleado } from './empleado.entity';
import { Permiso } from 'src/permisos/entities/permiso.entity';
import { Sucursal } from 'src/sucursal/entities/sucursal.entity';

@Entity('empleado_permisos')
@Unique(['empleado', 'permiso', 'sucursal'])
export class EmpleadoPermiso {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Empleado, (e) => e.permisosExtra, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'empleado_id' })
  empleado!: Empleado;

  @ManyToOne(() => Permiso, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permiso_id' })
  permiso!: Permiso;

  @ManyToOne(() => Sucursal, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal!: Sucursal;

  @Column({ type: 'enum', enum: ['grant', 'revoke'] })
  tipo!: 'grant' | 'revoke';

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
