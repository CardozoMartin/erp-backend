import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('sucursales')
export class Sucursal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  empresa_id!: string;

  @Column({ length: 150 })
  nombre!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  direccion!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono!: string | null;

  @Column({ default: true })
  activa!: boolean;

  @CreateDateColumn()
  creado_en!: Date;
}
