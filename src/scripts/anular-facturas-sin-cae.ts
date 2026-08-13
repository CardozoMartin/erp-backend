import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { ComprobantesService } from '../comprobantes/comprobantes.service';
import { Comprobante, EstadoComprobante } from '../comprobantes/entities/comprobante.entity';

/** Anula las facturas que quedaron sin CAE de los intentos fallidos de ARCA. */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const ds = app.get(DataSource);
    const repo = ds.getRepository(Comprobante);
    const svc = app.get(ComprobantesService);

    const basura = await repo
      .createQueryBuilder('c')
      .where("c.tipo LIKE 'FACTURA%'")
      .andWhere('c.cae IS NULL')
      .andWhere('c.estado = :e', { e: EstadoComprobante.EMITIDA })
      .getMany();

    if (!basura.length) { console.log('No hay facturas sin CAE para anular.'); return; }

    for (const c of basura) {
      await svc.cambiarEstado(c.id, c.sucursal_id, {
        estado: EstadoComprobante.ANULADO,
        motivo: 'Sin CAE: intento fallido de ARCA previo al fix A11',
      } as never, null);
      console.log(`  Anulada ${c.numero}`);
    }
    console.log(`\n${basura.length} factura(s) anulada(s).`);
  } finally {
    await app.close();
  }
}
main().catch((e) => { console.error('FALLO:', e instanceof Error ? e.message : e); process.exit(1); });
