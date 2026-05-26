import 'dotenv/config';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppSeedService } from './seed/app-seed.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuración de CORS - para el frontend en localhost:5173
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

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
        console.error('[ValidationPipe] Error de validacion:', JSON.stringify(detalles, null, 2));
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
