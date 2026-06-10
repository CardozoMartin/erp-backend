// clientes/entities/cliente.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CuentaCorriente } from './cuenta-corriente.entity';

export enum TipoCliente {
  CONSUMIDOR_FINAL = 'CONSUMIDOR_FINAL',
  RESPONSABLE_INSCRIPTO = 'RESPONSABLE_INSCRIPTO',
  MONOTRIBUTISTA = 'MONOTRIBUTISTA',
  EXENTO = 'EXENTO',
}

@Entity('clientes')
export class Cliente {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  nombre!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  apellido!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  razon_social!: string | null;

  @Column({
    type: 'enum',
    enum: TipoCliente,
    default: TipoCliente.CONSUMIDOR_FINAL,
  })
  tipo!: TipoCliente;

  @Column({ type: 'varchar', length: 13, nullable: true, unique: true })
  cuit!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  dni!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  direccion!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  altura!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  barrio!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  localidad!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  codigo_postal!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  referencia_entrega!: string | null;

  @Column({ default: true })
  activo!: boolean;

  // Relaciones
  @OneToOne(() => CuentaCorriente, (cc) => cc.cliente, { nullable: true })
  cuentaCorriente!: CuentaCorriente | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
