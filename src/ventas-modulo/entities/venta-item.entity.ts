import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('venta_item')
export class VentaItem {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    venta_id!: string;

    @Column()
    producto_id!: string;

    @Column({nullable: true})
    variante_id!: string;

    //Descripcion nombre del producto en el momento de la venta,no FK
    @Column()
    descripcion!: string;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    precio_unitario!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    cantidad!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    cantidad_retirada!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    descuento_porcentaje!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    descuento_monto!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    total!: number;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at!: Date;

}