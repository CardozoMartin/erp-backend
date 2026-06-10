// mp-config.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('mp_config')
export class MpConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'sucursal_id' })
  sucursalId!: string;

  // access_token cifrado con AES-256-GCM
  @Column({ name: 'access_token_enc', type: 'text' })
  accessTokenEnc!: string;

  // user_id de MP (no es secreto, pero lo guardamos para armar las URLs)
  @Column({ name: 'mp_user_id' })
  mpUserId!: string;

  // ID del POS en MP (lo crea el cliente en su panel MP)
  @Column({ name: 'mp_pos_id' })
  mpPosId!: string;

  // Nombre del POS para mostrar en el panel
  @Column({ name: 'mp_pos_nombre', nullable: true })
  mpPosNombre!: string;

  // Estado: 'pendiente' | 'activo' | 'error'
  @Column({ default: 'pendiente' })
  estado!: string;

  @Column({ name: 'ultimo_test', nullable: true, type: 'datetime' })
  ultimoTest!: Date | null;

  @Column({ name: 'ultimo_error', nullable: true, type: 'text' })
  ultimoError!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
