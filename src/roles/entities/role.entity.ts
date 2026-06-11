import { Permiso } from 'src/permisos/entities/permiso.entity';
import { EmpleadoRol } from 'src/empleados/entities/empleado-rol.entity';
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  nombre!: string; // 'Vendedor', 'Cajero', 'Depósito', 'Admin'

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion!: string | null;

  @Column({ type: 'varchar', length: 50 })
  rutaInicio!: string;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @ManyToMany(() => Permiso, { eager: true })
  @JoinTable({ name: 'rol_permisos' })
  permisos!: Permiso[];

  @OneToMany(() => EmpleadoRol, (er) => er.rol)
  empleadoRoles!: EmpleadoRol[];
}
