import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Empleado } from './empleado.entity';
import { Role } from 'src/roles/entities/role.entity';

@Entity('empleado_roles')
export class EmpleadoRol {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Empleado, (e) => e.empleadoRoles, { onDelete: 'CASCADE' })
  empleado!: Empleado;

  @ManyToOne(() => Role, (r) => r.empleadoRoles, { eager: true })
  rol!: Role;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  asignadoEn!: Date;
}
