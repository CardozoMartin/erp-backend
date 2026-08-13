import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { ArcaConfig } from '../arca/entities/arca-config.entity';

/**
 * Verificacion de A13/A14: el CUIT que se imprime debe ser el del certificado
 * ARCA, no la copia editable de configuracion_sucursal.
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  try {
    const ds = app.get(DataSource);
    const arca = await ds.getRepository(ArcaConfig).findOne({ where: {} });
    if (!arca) throw new Error('No hay configuracion ARCA');

    // Valor crudo en la tabla, sin pasar por el servicio
    const crudo = await ds.query(
      'SELECT cuit_ticket, punto_venta_arca FROM configuracion_sucursal WHERE sucursal_id = ?',
      [arca.sucursalId],
    );

    // Valor que realmente reciben impresion / PDF / email
    const config = await app
      .get(ConfiguracionService)
      .crearPorDefecto(arca.sucursalId);

    console.log('\n=========== A13 / A14 ===========');
    console.log(`Certificado ARCA (autoriza) : ${arca.cuit}  pv=${arca.puntoVenta}  [${arca.estado}]`);
    console.log(`En BD (configuracion)       : ${crudo[0]?.cuit_ticket}  pv=${crudo[0]?.punto_venta_arca ?? '-'}`);
    console.log(`Lo que se IMPRIME           : ${config.cuit_ticket}  pv=${config.punto_venta_arca ?? '-'}`);
    console.log('=================================');

    const ok = config.cuit_ticket === arca.cuit;
    console.log(
      ok
        ? '\nOK: se imprime el CUIT del certificado. La factura y el QR validan.'
        : '\nFALLA: el CUIT impreso NO es el del certificado.',
    );
    process.exitCode = ok ? 0 : 1;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('FALLO:', err instanceof Error ? err.message : err);
  process.exit(1);
});
