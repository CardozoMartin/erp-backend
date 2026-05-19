import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('marca_productos')
export class MarcaProducto {

    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ length: 100 })
    nombre!: string;

    @Column({ nullable: true })
    descripcion!: string;

    @Column({ nullable: true })
    logo_url!: string;

    @Column({ default: true })
    activo!: boolean;
}
