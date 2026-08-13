import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { FacturacionService } from '../facturacion/facturacion.service';
import { TipoEmisionFiscal } from '../facturacion/dto/emitir-comprobante-fiscal.dto';
import { Comprobante, TipoComprobante } from '../comprobantes/entities/comprobante.entity';

/**
 * A9 — emite dos facturas EN PARALELO. Sin lock ambas piden el mismo numero a
 * AFIP y una queda sin CAE (o duplica numeracion). Con lock, cada una obtiene su
 * propio numero y su propio CAE.
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const ds = app.get(DataSource);
    const repo = ds.getRepository(Comprobante);

    const ventas = await repo
      .createQueryBuilder('c')
      .where('c.tipo = :t', { t: TipoComprobante.VENTA })
      .andWhere('c.estado = :e', { e: 'COBRADA' })
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM comprobantes f
           WHERE f.comprobante_origen_id = c.id AND f.tipo LIKE 'FACTURA%')`,
      )
      .orderBy('c.created_at', 'DESC')
      .limit(2)
      .getMany();

    if (ventas.length < 2) throw new Error('Se necesitan 2 ventas cobradas sin facturar');

    const facturacion = app.get(FacturacionService);
    console.log(`Emitiendo EN PARALELO desde ${ventas.map((v) => v.numero).join(' y ')}...\n`);

    const resultados = await Promise.allSettled(
      ventas.map((venta) =>
        facturacion.emitir(
          venta.sucursal_id,
          venta.empleado_cajero_id ?? venta.empleado_vendedor_id!,
          { venta_id: venta.id, tipo: TipoEmisionFiscal.FACTURA_C } as never,
        ),
      ),
    );

    const emitidos: Comprobante[] = [];
    for (const [i, r] of resultados.entries()) {
      if (r.status === 'fulfilled') {
        const guardado = await repo.findOne({ where: { id: r.value.id } });
        emitidos.push(guardado!);
        console.log(`  [${i + 1}] ${guardado?.numero}  CAE ${guardado?.cae ?? '(NULL)'}`);
      } else {
        console.log(`  [${i + 1}] FALLO: ${String(r.reason).slice(0, 160)}`);
      }
    }

    console.log('\n=========== VALIDACION ===========');
    const numeros = emitidos.map((c) => c.numero_secuencial);
    const caes = emitidos.map((c) => c.cae).filter(Boolean);

    const checks: [string, boolean][] = [
      ['Las 2 emisiones tuvieron exito', emitidos.length === 2],
      ['Numeros distintos (sin colision)', new Set(numeros).size === numeros.length],
      ['Las 2 obtuvieron CAE', caes.length === emitidos.length && caes.length > 0],
      ['CAEs distintos', new Set(caes).size === caes.length],
    ];

    let ok = true;
    for (const [nombre, paso] of checks) {
      console.log(`  ${paso ? 'OK  ' : 'FALLA'}  ${nombre}`);
      if (!paso) ok = false;
    }
    console.log(ok ? '\nA9: lock funcionando.' : '\nA9: revisar.');
    process.exitCode = ok ? 0 : 1;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('FALLO:', err instanceof Error ? err.message : err);
  process.exit(1);
});
