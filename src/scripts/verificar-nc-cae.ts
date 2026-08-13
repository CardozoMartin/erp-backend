import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { NotasCreditoService } from '../notas-credito/notas-credito.service';
import { DestinoNotaCredito } from '../notas-credito/dto/create-nota-credito.dto';
import { Comprobante, TipoComprobante } from '../comprobantes/entities/comprobante.entity';

/**
 * A5 — emite una nota de crédito sobre una Factura C autorizada y verifica que
 * AFIP le otorgue su propio CAE (código 13, con CbtesAsoc a la factura origen).
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ds = app.get(DataSource);
    const repo = ds.getRepository(Comprobante);

    // Factura con CAE que todavia no tenga nota de credito
    const factura = await repo
      .createQueryBuilder('c')
      .where('c.tipo = :t', { t: TipoComprobante.FACTURA_C })
      .andWhere('c.cae IS NOT NULL')
      .andWhere('c.estado = :e', { e: 'EMITIDA' })
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM comprobantes n
           WHERE n.comprobante_origen_id = c.id AND n.tipo = 'NOTA_CREDITO')`,
      )
      .orderBy('c.created_at', 'DESC')
      .getOne();

    if (!factura) throw new Error('No hay Factura C con CAE sin nota de credito');
    console.log(
      `Factura origen : ${factura.numero}  CAE ${factura.cae}  (nro ${factura.numero_secuencial})`,
    );

    const nota = await app.get(NotasCreditoService).create(
      factura.sucursal_id,
      factura.empleado_cajero_id ?? factura.empleado_vendedor_id!,
      {
        comprobante_origen_id: factura.id,
        destino: DestinoNotaCredito.SOLO_EMITIR,
        reingresar_stock: false,
      } as never,
    );

    const guardada = await repo.findOne({ where: { id: nota.id } });
    console.log('\n=========== NOTA DE CREDITO ===========');
    console.log(`Numero        : ${guardada?.numero}`);
    console.log(`Codigo fiscal : ${guardada?.codigo_fiscal ?? '(NULL)'}  (013 = NC C)`);
    console.log(`CAE           : ${guardada?.cae ?? '(NULL)'}`);
    console.log(`Vto CAE       : ${guardada?.cae_vencimiento?.toISOString().slice(0, 10) ?? '(NULL)'}`);
    console.log(`Total         : ${guardada?.total}`);
    console.log(`Observacion   : ${guardada?.observaciones ?? ''}`);
    console.log('=======================================');

    const checks: [string, boolean][] = [
      ['La NC obtuvo CAE de AFIP', !!guardada?.cae],
      ['CAE distinto al de la factura', guardada?.cae !== factura.cae],
      ['Codigo fiscal 013 (NC C)', guardada?.codigo_fiscal === '013'],
      ['Tiene vencimiento de CAE', !!guardada?.cae_vencimiento],
    ];

    let ok = true;
    console.log('\nValidacion:');
    for (const [nombre, paso] of checks) {
      console.log(`  ${paso ? 'OK  ' : 'FALLA'}  ${nombre}`);
      if (!paso) ok = false;
    }
    console.log(ok ? '\nA5: notas de credito con CAE funcionando.' : '\nA5: revisar.');
    process.exitCode = ok ? 0 : 1;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('FALLO:', err instanceof Error ? err.message : err);
  process.exit(1);
});
