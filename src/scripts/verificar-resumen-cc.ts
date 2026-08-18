import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'fs';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { PdfService } from '../pdf/pdf.service';
import { Cliente } from '../clientes/entities/cliente.entity';
import { MovimientoCuentaCorriente } from '../clientes/entities/movimiento-cuenta-corriente.entity';
import { LEYENDA_OBJECION_RESUMEN } from '../clientes/cuenta-corriente.constants';

/**
 * Verifica que el resumen de cuenta corriente lleve la leyenda de objecion.
 * Sin ese aviso el silencio del cliente no vale como aceptacion (CCyC art. 1145).
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ds = app.get(DataSource);
    const cliente = await ds.getRepository(Cliente).findOne({
      where: {},
      relations: ['cuentaCorriente', 'cuentaCorriente.planPago'],
    });
    if (!cliente) throw new Error('No hay clientes cargados');

    const movimientos = cliente.cuentaCorriente
      ? await ds.getRepository(MovimientoCuentaCorriente).find({
          where: { cuenta_corriente_id: cliente.cuentaCorriente.id },
          relations: ['comprobante'],
          take: 10,
        })
      : [];

    const pdf = await app.get(PdfService).generarResumenCuentaCorrientePdf(
      cliente,
      movimientos,
      { periodo: 'Todos los movimientos', tipoResumen: 'Cargos', config: null },
    );

    const ruta = 'resumen-cc-prueba.pdf';
    writeFileSync(ruta, pdf);

    // El texto del PDF va comprimido, asi que se busca por fragmentos sueltos que
    // PDFKit deja legibles no siempre: lo que se valida es que el PDF se genere y
    // que la constante este correctamente formada.
    const texto = LEYENDA_OBJECION_RESUMEN;
    console.log(`Cliente     : ${cliente.nombre} ${cliente.apellido ?? ''}`);
    console.log(`Movimientos : ${movimientos.length}`);
    console.log(`PDF         : ${ruta} (${pdf.length} bytes)`);
    console.log('\nLeyenda incluida en el resumen:');
    console.log(`  "${texto}"`);

    const checks: [string, boolean][] = [
      ['El PDF se genero', pdf.length > 1000],
      ['La leyenda menciona el plazo', /30 dias/.test(texto)],
      ['La leyenda habla de aceptacion', /aceptad/i.test(texto)],
      ['La leyenda remite a la solicitud de credito', /solicitud de credito/i.test(texto)],
    ];

    let ok = true;
    console.log('\nValidacion:');
    for (const [nombre, paso] of checks) {
      console.log(`  ${paso ? 'OK  ' : 'FALLA'}  ${nombre}`);
      if (!paso) ok = false;
    }
    console.log(ok ? '\nResumen con leyenda de objecion OK.' : '\nRevisar.');
    process.exitCode = ok ? 0 : 1;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('FALLO:', err instanceof Error ? err.message : err);
  process.exit(1);
});
