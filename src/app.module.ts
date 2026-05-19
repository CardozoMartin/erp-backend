import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductoCategoriaModule } from './producto-categoria/producto-categoria.module';
import { VentasModuloModule } from './ventas-modulo/ventas-modulo.module';
import { PagosModuleModule } from './pagos-module/pagos-module.module';
import { RetirosModuleModule } from './retiros-module/retiros-module.module';
import { SucursalModule } from './sucursal/sucursal.module';

// Modulos del dominio de Producto
import { ProductoModule } from './producto/producto.module';
import { StockModule } from './stock/stock.module';
import { OfertaModule } from './oferta/oferta.module';
import { VarianteModule } from './variante/variante.module';
import { ImagenModule } from './imagen/imagen.module';
import { LoteModule } from './lote/lote.module';
import { AtributoVarianteModule } from './atributo-variante/atributo-variante.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { ProductoPreciosModule } from './producto_precios/producto_precios.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      username: process.env.DB_USER?.trim() || process.env.DB_USERNAME?.trim() || 'root',
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
    PagosModuleModule,
    RetirosModuleModule,
    SucursalModule,
    CloudinaryModule,
    ProductoPreciosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
