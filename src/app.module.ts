import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PagosModule } from './pagos-module/pagos-module.module';
import { ProductoCategoriaModule } from './producto-categoria/producto-categoria.module';
import { RetirosModuleModule } from './retiros-module/retiros-module.module';
import { SucursalModule } from './sucursal/sucursal.module';
import { VentasModuloModule } from './ventas-modulo/ventas-modulo.module';

// Modulos del dominio de Producto
import { AtributoVarianteModule } from './atributo-variante/atributo-variante.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { ConfigPosModule } from './config-pos/config-pos.module';
import { EmpleadosModule } from './empleados/empleados.module';
import { ImagenModule } from './imagen/imagen.module';
import { LoteModule } from './lote/lote.module';
import { MarcaProductosModule } from './marca_productos/marca_productos.module';
import { OfertaModule } from './oferta/oferta.module';
import { PermisosModule } from './permisos/permisos.module';
import { ProductoModule } from './producto/producto.module';
import { ProductoPreciosModule } from './producto_precios/producto_precios.module';
import { RolesModule } from './roles/roles.module';
import { StockModule } from './stock/stock.module';
import { VarianteModule } from './variante/variante.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      username:
        process.env.DB_USER?.trim() ||
        process.env.DB_USERNAME?.trim() ||
        'root',
      password:
        process.env.DB_PASS?.trim() || process.env.DB_PASSWORD?.trim() || '',
      database: process.env.DB_NAME || 'erp',
      synchronize: true,
      autoLoadEntities: true,
    }),
    ProductoModule,
    ProductoCategoriaModule,
    StockModule,
    LoteModule,
    ImagenModule,
    OfertaModule,
    VarianteModule,
    AtributoVarianteModule,
    VentasModuloModule,
    PagosModule,
    RetirosModuleModule,
    SucursalModule,
    CloudinaryModule,
    ProductoPreciosModule,
    MarcaProductosModule,
    EmpleadosModule,
    PermisosModule,
    RolesModule,
    ConfigPosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
