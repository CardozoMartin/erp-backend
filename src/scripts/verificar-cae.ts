import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { FacturacionService } from '../facturacion/facturacion.service';
import { TipoEmisionFiscal } from '../facturacion/dto/emitir-comprobante-fiscal.dto';
import { Comprobante, TipoComprobante } from '../comprobantes/entities/comprobante.entity';
import { ArcaConfig } from '../arca/entities/arca-config.entity';

/**
 * Verificacion de A11: comprueba end-to-end que el CAE de AFIP llega a la BD.
 * Emite una Factura C real contra homologacion tomando una venta ya cobrada.
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ds = app.get(DataSource);
    const comprobanteRepo = ds.getRepository(Comprobante);
    const arcaRepo = ds.getRepository(ArcaConfig);

    // 1.- Estado de la configuracion ARCA
    const config = await arcaRepo.findOne({ where: {} });
    if (!config) throw new Error('No hay configuracion ARCA cargada');
    console.log(
      `ARCA -> cuit=${config.cuit} pv=${config.puntoVenta} ambiente=${config.ambiente} estado=${config.estado}`,
    );
    if (config.estado !== 'activo') {
      throw new Error(`ARCA no esta activo (estado=${config.estado}); probar conexion primero`);
    }

    // 2.- Buscar una venta cobrada que todavia no tenga factura emitida
    const venta = await comprobanteRepo
      .createQueryBuilder('c')
      .where('c.tipo = :tipo', { tipo: TipoComprobante.VENTA })
      .andWhere('c.estado = :estado', { estado: 'COBRADA' })
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM comprobantes f
           WHERE f.comprobante_origen_id = c.id AND f.tipo LIKE 'FACTURA%')`,
      )
      .orderBy('c.created_at', 'DESC')
      .getOne();

    if (!venta) throw new Error('No hay ventas cobradas sin facturar disponibles');
    console.log(`Venta origen -> ${venta.numero} (total ${venta.total})`);

    // 3.- Emitir la Factura C por el mismo camino que usa el endpoint
    const facturacion = app.get(FacturacionService);
    const empleadoId = venta.empleado_cajero_id ?? venta.empleado_vendedor_id;
    if (!empleadoId) throw new Error('La venta no tiene empleado asociado');

    const emitido = await facturacion.emitir(venta.sucursal_id, empleadoId, {
      venta_id: venta.id,
      tipo: TipoEmisionFiscal.FACTURA_C,
    } as never);

    // 4.- Releer de la BD: la prueba real es que el CAE quedo persistido
    const guardado = await comprobanteRepo.findOne({ where: { id: emitido.id } });
    console.log('\n================ RESULTADO ================');
    console.log(`Comprobante : ${guardado?.numero}`);
    console.log(`CAE         : ${guardado?.cae ?? '(NULL)'}`);
    console.log(`Vencimiento : ${guardado?.cae_vencimiento?.toISOString().slice(0, 10) ?? '(NULL)'}`);
    console.log(`Observacion : ${guardado?.observaciones ?? ''}`);
    console.log('==========================================');
    console.log(guardado?.cae ? '\nA11 RESUELTO: el CAE llego a la BD.' : '\nA11 SIGUE ABIERTO: sin CAE (ver observacion).');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('FALLO:', err instanceof Error ? err.message : err);
  process.exit(1);
});
