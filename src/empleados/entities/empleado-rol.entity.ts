// empleados/entities/empleado-rol.entity.ts
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Empleado } from './empleado.entity';
import { Role } from 'src/roles/entities/role.entity';
import { Sucursal } from 'src/sucursal/entities/sucursal.entity';

@Entity('empleado_roles')
export class EmpleadoRol {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Empleado, (e) => e.empleadoRoles, { onDelete: 'CASCADE' })
  empleado!: Empleado;

  @ManyToOne(() => Role, (r) => r.empleadoRoles, { eager: true })
  rol!: Role;

  //rol asignado en qué sucursal
  @ManyToOne(() => Sucursal, {
    eager: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal!: Sucursal | null;

  @Column({ default: true })
  activo!: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  asignadoEn!: Date;
}
