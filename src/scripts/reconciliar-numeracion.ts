import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { ArcaWsfev1Service } from '../arca/arca-wsfev1.service';
import { ArcaConfig } from '../arca/entities/arca-config.entity';
import { Comprobante } from '../comprobantes/entities/comprobante.entity';

/**
 * A9 — compara la numeracion local contra la autorizada en AFIP.
 * Solo lee: no modifica nada. Sirve para saber que hay que reconciliar.
 */
const CODIGOS: Record<string, number> = {
  FACTURA_A: 1,
  FACTURA_B: 6,
  FACTURA_C: 11,
};

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });

  try {
    const ds = app.get(DataSource);
    const arca = await ds.getRepository(ArcaConfig).findOne({ where: {} });
    if (!arca) throw new Error('No hay configuracion ARCA');

    const wsfev1 = app.get(ArcaWsfev1Service);
    const puntoVenta = Number(arca.puntoVenta);

    console.log(`\nCUIT ${arca.cuit} · PV ${arca.puntoVenta} · ${arca.ambiente}\n`);

    for (const [tipo, codigo] of Object.entries(CODIGOS)) {
      const enAfip = await wsfev1.ultimoComprobante(arca, codigo, puntoVenta);

      const locales = await ds
        .getRepository(Comprobante)
        .createQueryBuilder('c')
        .where('c.tipo = :tipo', { tipo })
        .andWhere('c.sucursal_id = :s', { s: arca.sucursalId })
        .orderBy('c.numero_secuencial', 'ASC')
        .getMany();

      const conCae = locales.filter((c) => c.cae);
      // Las anuladas ya no reclaman su numero: no cuentan como colision
      const sinCae = locales.filter((c) => !c.cae && c.estado !== 'ANULADO');
      const maxLocal = locales.at(-1)?.numero_secuencial ?? 0;

      console.log(`── ${tipo} (cod ${codigo}) ──`);
      console.log(`   AFIP autorizo hasta : ${enAfip}`);
      console.log(`   Max local           : ${maxLocal}`);
      console.log(`   Locales con CAE     : ${conCae.length}`);
      console.log(`   Locales SIN CAE     : ${sinCae.length}${sinCae.length ? ` -> ${sinCae.map((c) => c.numero).join(', ')}` : ''}`);

      // Un numero local sin CAE ocupando un numero que AFIP ya autorizo es el
      // caso peligroso: el proximo pedido chocaria o duplicaria numeracion.
      const colisiones = sinCae.filter((c) => c.numero_secuencial <= enAfip);
      if (colisiones.length) {
        console.log(
          `   ⚠️  COLISION: ${colisiones.map((c) => c.numero).join(', ')} ocupan numeros que AFIP ya autorizo`,
        );
      }
      if (maxLocal > enAfip) {
        console.log(`   ⚠️  Hay numeracion local por delante de AFIP`);
      }
      if (!colisiones.length && maxLocal <= enAfip) {
        console.log(`   OK: sin colisiones`);
      }
      console.log();
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('FALLO:', err instanceof Error ? err.message : err);
  process.exit(1);
});
