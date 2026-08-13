import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'fs';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { PdfService } from '../pdf/pdf.service';
import { QrAfipService } from '../pdf/qr-afip.service';
import { ComprobantesService } from '../comprobantes/comprobantes.service';
import { Comprobante } from '../comprobantes/entities/comprobante.entity';

/** Verificacion de A16/A17: QR generado localmente y embebido en el PDF. */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  try {
    const ds = app.get(DataSource);

    // Ultimo comprobante CON CAE: es el unico que debe llevar QR
    const comprobante = await ds
      .getRepository(Comprobante)
      .createQueryBuilder('c')
      .where('c.cae IS NOT NULL')
      .orderBy('c.created_at', 'DESC')
      .getOne();

    if (!comprobante) throw new Error('No hay comprobantes con CAE');
    console.log(`Comprobante : ${comprobante.numero}  CAE ${comprobante.cae}`);

    // 1.- URL del QR (sin red)
    const qrService = app.get(QrAfipService);
    const config = await app
      .get(ComprobantesService)
      .generarQrFiscal(comprobante.id, comprobante.sucursal_id);
    console.log(`QR PNG      : ${config ? `${config.length} bytes` : 'NO GENERADO'}`);

    // 2.- PDF completo
    const pdf = await app
      .get(PdfService)
      .generarComprobantePdf(comprobante.id, comprobante.sucursal_id);
    const salida = 'comprobante-verificacion.pdf';
    writeFileSync(salida, pdf);
    console.log(`PDF         : ${pdf.length} bytes -> ${salida}`);

    // 3.- El PNG debe estar embebido dentro del PDF
    const tieneImagen = pdf.includes(Buffer.from('/Image'));
    console.log(`QR embebido : ${tieneImagen ? 'SI' : 'NO'}`);

    const ok = !!config && tieneImagen;
    console.log(ok ? '\nOK: A16/A17 verificados.' : '\nFALLA: revisar.');
    process.exitCode = ok ? 0 : 1;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('FALLO:', err instanceof Error ? err.message : err);
  process.exit(1);
});
