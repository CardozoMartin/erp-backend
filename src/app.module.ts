import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PagosModule } from './pagos-module/pagos-module.module';
import { ProductoCategoriaModule } from './producto-categoria/producto-categoria.module';
import { SucursalModule } from './sucursal/sucursal.module';

// Modulos del dominio de Producto
import { AtributoVarianteModule } from './atributo-variante/atributo-variante.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { EmpleadosModule } from './empleados/empleados.module';
import { ImagenModule } from './imagen/imagen.module';
import { LoteModule } from './lote/lote.module';
import { MarcaProductosModule } from './marca_productos/marca_productos.module';
import { OfertaModule } from './oferta/oferta.module';
import { PermisosModule } from './permisos/permisos.module';
import { ProductoModule } from './producto/producto.module';
import { ProductoPreciosModule } from './producto_precios/producto_precios.module';
import { RolesModule } from './roles/roles.module';
import { AppSeedService } from './seed/app-seed.service';
import { StockModule } from './stock/stock.module';
import { StockMovimientosModule } from './stock-movimientos/stock-movimientos.module';
import { VarianteModule } from './variante/variante.module';
import { AuthModule } from './auth/auth.module';
import { CajaModule } from './caja/caja.module';
import { ComprobantesModule } from './comprobantes/comprobantes.module';
import { ConfiguracionModule } from './configuracion/configuracion.module';
import { ClientesModule } from './clientes/clientes.module';
import { ListaPrecioModule } from './lista-precio/lista-precio.module';
import { PagosPosModule } from './pagos-pos/pagos-pos.module';
import { DespachosModule } from './despachos/despachos.module';
import { CotizacionesModule } from './cotizaciones/cotizaciones.module';
import { NotasCreditoModule } from './notas-credito/notas-credito.module';
import { FacturacionModule } from './facturacion/facturacion.module';
import { PosVentasModule } from './pos-ventas/pos-ventas.module';
import { ReportesPosModule } from './reportes-pos/reportes-pos.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { PedidosEnvioModule } from './pedidos-envio/pedidos-envio.module';
import { Empleado } from './empleados/entities/empleado.entity';
import { EmpleadoSucursal } from './empleados/entities/empleado-sucursal.entity';
import { ConfiguracionSucursal } from './configuracion/entities/configuracion.entity';
import { ListaPrecio } from './lista-precio/entities/lista-precio.entity';
import { MarcaProducto } from './marca_productos/entities/marca_producto.entity';
import { ProductoCategoria } from './producto-categoria/entities/producto-categoria.entity';
import { ProductoSucursal } from './producto/entities/producto-sucursal-entity';
import { Producto } from './producto/entities/producto.entity';
import { ProductoPrecio } from './producto_precios/entities/producto_precio.entity';
import { Stock } from './stock/entities/stock.entity';

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
    TypeOrmModule.forFeature([
      Empleado,
      EmpleadoSucursal,
      ConfiguracionSucursal,
      ListaPrecio,
      MarcaProducto,
      ProductoCategoria,
      Producto,
      ProductoPrecio,
      ProductoSucursal,
      Stock,
    ]),
    ProductoModule,
    ProductoCategoriaModule,
    StockModule,
    StockMovimientosModule,
    LoteModule,
    ImagenModule,
    OfertaModule,
    VarianteModule,
    AtributoVarianteModule,
    PagosModule,
    SucursalModule,
    CloudinaryModule,
    ProductoPreciosModule,
    MarcaProductosModule,
    EmpleadosModule,
    PermisosModule,
    RolesModule,
    AuthModule,
    CajaModule,
    ComprobantesModule,
    ConfiguracionModule,
    ClientesModule,
    ListaPrecioModule,
    PagosPosModule,
    DespachosModule,
    CotizacionesModule,
    NotasCreditoModule,
    FacturacionModule,
    PosVentasModule,
    ReportesPosModule,
    AuditoriaModule,
    PedidosEnvioModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppSeedService],
})
export class AppModule {}
