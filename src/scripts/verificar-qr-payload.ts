import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { QrAfipService } from '../pdf/qr-afip.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { Comprobante } from '../comprobantes/entities/comprobante.entity';
import { ArcaConfig } from '../arca/entities/arca-config.entity';

/** Decodifica el payload del QR y valida cada campo contra la RG 4892. */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });

  try {
    const ds = app.get(DataSource);
    const comprobante = await ds
      .getRepository(Comprobante)
      .createQueryBuilder('c')
      .where('c.cae IS NOT NULL')
      .orderBy('c.created_at', 'DESC')
      .getOne();
    if (!comprobante) throw new Error('No hay comprobantes con CAE');

    const arca = await ds.getRepository(ArcaConfig).findOne({ where: {} });
    const config = await app
      .get(ConfiguracionService)
      .crearPorDefecto(comprobante.sucursal_id);

    const url = app.get(QrAfipService).construirUrl({
      comprobante,
      cuitEmisor: config?.cuit_ticket,
      puntoVenta: comprobante.punto_venta ?? config?.punto_venta_arca,
      codigoFiscal: comprobante.codigo_fiscal,
      cliente: null,
    });

    console.log(`\nURL: ${url}\n`);

    const b64 = url.split('?p=')[1] ?? '';
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    console.log('Payload decodificado:');
    console.log(JSON.stringify(payload, null, 2));

    const cuitEsperado = Number(String(arca?.cuit ?? '').replace(/\D/g, ''));
    const checks: [string, boolean][] = [
      ['URL apunta al verificador de AFIP', url.startsWith('https://www.afip.gob.ar/fe/qr/?p=')],
      ['ver = 1', payload.ver === 1],
      ['fecha YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(payload.fecha)],
      ['cuit = el del certificado ARCA', payload.cuit === cuitEsperado],
      ['ptoVta > 0', payload.ptoVta > 0],
      ['tipoCmp > 0', payload.tipoCmp > 0],
      ['nroCmp > 0', payload.nroCmp > 0],
      ['importe > 0', payload.importe > 0],
      ['moneda = PES', payload.moneda === 'PES'],
      ['tipoCodAut = E', payload.tipoCodAut === 'E'],
      ['codAut = CAE del comprobante', String(payload.codAut) === String(comprobante.cae)],
    ];

    console.log('\nValidacion:');
    let ok = true;
    for (const [nombre, paso] of checks) {
      console.log(`  ${paso ? 'OK  ' : 'FALLA'}  ${nombre}`);
      if (!paso) ok = false;
    }
    console.log(ok ? '\nQR valido segun RG 4892.' : '\nQR INVALIDO.');
    process.exitCode = ok ? 0 : 1;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('FALLO:', err instanceof Error ? err.message : err);
  process.exit(1);
});
