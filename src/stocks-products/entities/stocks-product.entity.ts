import { Producto } from "src/producto/entities/producto.entity";
import { Variante } from "src/producto/entities/variante.entity";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

@Entity()
@Unique(['producto_id','variante_id','sucursal_id'])
export class StocksProduct {

    @PrimaryGeneratedColumn('uuid')
    id!:string;

    @ManyToMany(()=> Producto, (p)=> p.stock,{onDelete:'CASCADE'})
    @JoinColumn({name:'producto_id'})
    producto!:Producto;

    @Column()
    producto_id!:string;

    @ManyToMany(()=> Variante, (v)=> v.stock, {nullable:true, onDelete:'CASCADE'})
    @JoinColumn({name:'variante_id'})
    variante!:Variante;

    @Column({nullable:true})
    variante_id!:string | null;

    @Column()
    sucursal_id!:string;

    @Column({type:'decimal', precision: 10, scale: 2, default: 0})
    cantidad!:number;

    @Column({type:'decimal', precision: 10, scale: 2, default: 0})
    cantidad_minima!:number;

    @CreateDateColumn()
    created_at!:Date;

    @UpdateDateColumn()
    updated_at!:Date;
}
