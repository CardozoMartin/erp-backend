import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AppSeedService } from '../seed/app-seed.service';

async function bootstrap() {
  const logger = new Logger('SeedPermisos');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const appSeedService = app.get(AppSeedService);
    await appSeedService.seedInitialData(true);
    logger.log('Seed inicial ejecutado correctamente');
  } finally {
    await app.close();
  }
}

void bootstrap().catch((error) => {
  const logger = new Logger('SeedPermisos');
  logger.error('No se pudo ejecutar el seed inicial', error);
  process.exit(1);
});
