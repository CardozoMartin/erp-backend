import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { ConfiguracionEmailSucursal } from './configuracion/entities/configuracion-email.entity';
import { ConfiguracionSucursal } from './configuracion/entities/configuracion.entity';
import { ListaPrecio } from './lista-precio/entities/lista-precio.entity';
import { MarcaProducto } from './marca_productos/entities/marca_producto.entity';
import { ProductoCategoria } from './producto-categoria/entities/producto-categoria.entity';
import { ProductoSucursal } from './producto/entities/producto-sucursal-entity';
import { Producto } from './producto/entities/producto.entity';
import { ProductoPrecio } from './producto_precios/entities/producto_precio.entity';
import { Stock } from './stock/entities/stock.entity';
import { MercadopagoModule } from './mercadopago/mercadopago.module';
import { ArcaModule } from './arca/arca.module';
import { BackupModule } from './backup/backup.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV:    Joi.string().valid('development', 'production', 'test').default('development'),
        PORT:        Joi.number().default(3000),
        CORS_ORIGIN: Joi.string().default('http://localhost:5173'),

        // Base de datos
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(3306),
        DB_USER: Joi.string().required(),
        DB_PASS: Joi.string().required(),
        DB_NAME: Joi.string().required(),

        // Autenticación
        JWT_SECRET: Joi.string().min(32).required(),

        // Clave maestra de cifrado — cifra emails, backup, y cualquier secreto en DB
        MASTER_ENCRYPT_KEY: Joi.string().min(32).required(),

        // MercadoPago
        MP_ENCRYPT_KEY:    Joi.string().min(32).required(),
        MP_WEBHOOK_SECRET: Joi.string().min(16).required(),

        // Cloudinary
        CLOUDINARY_CLOUD_NAME: Joi.string().required(),
        CLOUDINARY_API_KEY:    Joi.string().required(),
        CLOUDINARY_API_SECRET: Joi.string().required(),

        // ARCA — opcional hasta tener las credenciales de AFIP
        ARCA_ENCRYPT_KEY: Joi.string().min(16).optional(),
      }),
    }),
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000,
        limit: 300,
      },
    ]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host:     config.getOrThrow('DB_HOST'),
        port:     config.getOrThrow<number>('DB_PORT'),
        username: config.getOrThrow('DB_USER'),
        password: config.getOrThrow('DB_PASS'),
        database: config.getOrThrow('DB_NAME'),
        synchronize: config.get('NODE_ENV') !== 'production',
        autoLoadEntities: true,
      }),
    }),
    TypeOrmModule.forFeature([
      Empleado,
      EmpleadoSucursal,
      ConfiguracionEmailSucursal,
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
    MercadopagoModule,
    ArcaModule,
    BackupModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppSeedService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
