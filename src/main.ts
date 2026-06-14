import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppSeedService } from './seed/app-seed.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermisosGuard } from './auth/guards/permisos.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));

  // Configuración de CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
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

  const appSeedService = app.get(AppSeedService);
  await appSeedService.seedInitialData();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
