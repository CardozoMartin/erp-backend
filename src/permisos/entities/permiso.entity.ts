import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('permisos')
export class Permiso {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  clave!: string;

  @Column({ type: 'varchar', length: 150 })
  nombre!: string;

  @Column({ type: 'varchar', length: 50 })
  modulo!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion!: string | null;

  @Column({ default: true })
  estado!: boolean;
}
