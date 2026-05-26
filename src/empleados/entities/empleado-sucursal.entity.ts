// empleados/entities/empleado-sucursal.entity.ts
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
import { Sucursal } from 'src/sucursal/entities/sucursal.entity';

@Entity('empleado_sucursales')
@Unique(['empleado', 'sucursal'])
export class EmpleadoSucursal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Empleado, (e) => e.sucursales, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'empleado_id' })
  empleado!: Empleado;

  @ManyToOne(() => Sucursal, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal!: Sucursal;

  @Column({ name: 'es_sucursal_principal', default: false })
  esSucursalPrincipal!: boolean;

  @Column({ default: true })
  activo!: boolean;

  @CreateDateColumn({ name: 'fecha_asignacion' })
  fechaAsignacion!: Date;
}
