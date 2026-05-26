import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { permisosSeed } from '../permisos/permisos-seed';
import { PermisosService } from '../permisos/permisos.service';

async function bootstrap() {
  const logger = new Logger('SeedPermisos');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const permisosService = app.get(PermisosService);
    const { creados, existentes } =
      await permisosService.createMissing(permisosSeed);

    logger.log(`Permisos analizados: ${permisosSeed.length}`);
    logger.log(`Permisos existentes: ${existentes.length}`);
    logger.log(`Permisos creados: ${creados.length}`);

    creados.forEach((permiso) => {
      logger.log(`Creado: ${permiso.clave} - ${permiso.nombre}`);
    });
  } finally {
    await app.close();
  }
}

void bootstrap().catch((error) => {
  const logger = new Logger('SeedPermisos');
  logger.error('No se pudieron crear los permisos faltantes', error);
  process.exit(1);
});
