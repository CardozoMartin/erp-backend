import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermisosGuard } from './auth/guards/permisos.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));

  // Configuración de CORS
  app.enableCors({
    origin: configService.getOrThrow<string>('CORS_ORIGIN'),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Guards globales — protegen TODO por defecto
  // Las rutas públicas usan @Publico() para saltear el JWT
  const reflector = app.get(Reflector);
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new PermisosGuard(reflector),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const detalles = errors.map((error) => ({
          campo: error.property,
          valor: error.value,
          errores: error.constraints,
          hijos: error.children?.map((child) => ({
            campo: child.property,
            valor: child.value,
            errores: child.constraints,
            hijos: child.children,
          })),
        }));
        console.error(
          '[ValidationPipe] Error de validacion:',
          JSON.stringify(detalles, null, 2),
        );
        return new BadRequestException({
          message: 'Error de validacion',
          errores: detalles,
        });
      },
    }),
  );

  // Swagger — solo disponible fuera de producción
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ERP Gestión Contable de Ventas')
      .setDescription('API del sistema ERP — autenticación JWT requerida')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT',
      )
      .addTag('auth', 'Autenticación y sesión')
      .addTag('productos', 'Gestión de productos e inventario')
      .addTag('stock', 'Stock por sucursal y alertas')
      .addTag('pos-ventas', 'Punto de venta y comprobantes')
      .addTag('comprobantes', 'Comprobantes fiscales')
      .addTag('pagos-pos', 'Pagos en POS')
      .addTag('caja', 'Apertura y cierre de caja')
      .addTag('clientes', 'Gestión de clientes y cuenta corriente')
      .addTag('empleados', 'Gestión de empleados y roles')
      .addTag('sucursal', 'Sucursales')
      .addTag('reportes-pos', 'Reportes y métricas')
      .addTag('configuracion', 'Configuración por sucursal')
      .addTag('mercadopago', 'Integración MercadoPago QR')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        defaultModelsExpandDepth: -1,
      },
    });
  }

  // El seed NO corre en el arranque: reescribia datos que el usuario ya habia
  // guardado desde la UI. Se ejecuta a demanda con `npm run seed`.
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
