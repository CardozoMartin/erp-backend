import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

export enum ESTADO{ COTIZACION= 'COTIZACION',
    ORDEN_DE_VENTA= 'ORDEN_DE_VENTA',
    PARCIALMENTE_RETIRADO= 'PARCIALMENTE_RETIRO',
    RETIRADO= 'RETIRO',
    FACTURADO= 'FACTURADO',
    ANULADO= 'ANULADO',
}
@Entity()
export class VentasModulo {

    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    estado!: ESTADO;

    @Column({ nullable: true })
    caja_id!: string;

    @Column({ nullable: true })
    sucursal_id!: string;

    @Column({ nullable: true })
    cliente_id!: string;

    @Column({ nullable: true })
    usuario_id!: string;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    subtotal!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    descuento_total!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    total!: number;

    @Column({nullable: true})
    notas!: string;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at!: Date;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at!: Date;
}
