// empleados/entities/empleado.entity.ts
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { EmpleadoRol } from './empleado-rol.entity';
import { EmpleadoSucursal } from './empleado-sucursal.entity';
import { EmpleadoPermiso } from './empleado-permiso.entity';

@Entity('empleados')
export class Empleado {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  nombreCompleto!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 20 })
  telefono!: string;

  @Column({ type: 'varchar', length: 255 })
  direccion!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  contrasena!: string;

  @Column({ type: 'varchar', length: 50 })
  cargo!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  foto_url!: string | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @OneToMany(() => EmpleadoRol, (er) => er.empleado, { eager: true })
  empleadoRoles!: EmpleadoRol[];

  //NUEVAS relaciones
  @OneToMany(() => EmpleadoSucursal, (es) => es.empleado)
  sucursales!: EmpleadoSucursal[];

  @OneToMany(() => EmpleadoPermiso, (ep) => ep.empleado)
  permisosExtra!: EmpleadoPermiso[];
}
