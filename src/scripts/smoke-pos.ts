import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AppSeedService } from '../seed/app-seed.service';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Sucursal } from '../sucursal/entities/sucursal.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { ProductoCategoria } from '../producto-categoria/entities/producto-categoria.entity';
import { Producto, UnidadVenta } from '../producto/entities/producto.entity';
import { ProductoSucursal } from '../producto/entities/producto-sucursal-entity';
import { Stock } from '../stock/entities/stock.entity';
import { MedioPago } from '../pagos-module/entities/medio-pago.entity';
import { CajaService } from '../caja/caja.service';
import { PosVentasService } from '../pos-ventas/pos-ventas.service';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service';
import { NotasCreditoService } from '../notas-credito/notas-credito.service';
import { FacturacionService } from '../facturacion/facturacion.service';
import { TipoEmisionFiscal } from '../facturacion/dto/emitir-comprobante-fiscal.dto';
import { TipoPagoPos } from '../pagos-pos/entities/pago-pos.entity';
import { DestinoNotaCredito } from '../notas-credito/dto/create-nota-credito.dto';
import { EstadoComprobante } from '../comprobantes/entities/comprobante.entity';
import { DespachosService } from '../despachos/despachos.service';
import { EstadoDespacho } from '../despachos/entities/despacho.entity';

async function repo<T extends object>(
  dataSource: DataSource,
  entity: new () => T,
): Promise<Repository<T>> {
  return dataSource.getRepository(entity);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    await app.get(AppSeedService).seedInitialData(false);

    const dataSource = app.get(DataSource);
    const sucursalRepo = await repo(dataSource, Sucursal);
    const empleadoRepo = await repo(dataSource, Empleado);
    const categoriaRepo = await repo(dataSource, ProductoCategoria);
    const productoRepo = await repo(dataSource, Producto);
    const productoSucursalRepo = await repo(dataSource, ProductoSucursal);
    const stockRepo = await repo(dataSource, Stock);
    const medioPagoRepo = await repo(dataSource, MedioPago);

    const sucursal = await sucursalRepo.findOne({ where: { nombre: 'Shaddai' } });
    const empleado = await empleadoRepo.findOne({
      where: { email: 'martin@gmail.com' },
    });
    const efectivo = await medioPagoRepo.findOne({ where: { nombre: 'Efectivo' } });

    if (!sucursal || !empleado || !efectivo) {
      throw new Error('Faltan datos seed: sucursal, empleado admin o medio efectivo');
    }

    let categoria = await categoriaRepo.findOne({
      where: { nombre: 'SMOKE POS' },
    });
    if (!categoria) {
      categoria = await categoriaRepo.save(
        categoriaRepo.create({
          nombre: 'SMOKE POS',
          descripcion: 'Categoria para pruebas POS',
          color_identificador: '#1f7a4d',
          activo: true,
          padre_id: null,
        }),
      );
    }

    const codigo = 'SMOKE-POS-001';
    let producto = await productoRepo.findOne({ where: { codigo_barras: codigo } });
    if (!producto) {
      producto = await productoRepo.save(
        productoRepo.create({
          nombre: 'Producto Smoke POS',
          codigo_barras: codigo,
          descripcion: 'Producto usado por prueba smoke POS',
          activo: true,
          activo_pos: true,
          activo_web: false,
          precio_base: 100,
          precio_costo: 60,
          precio_venta: 100,
          margen_ganancia: 66.67,
          unidad_venta: UnidadVenta.UNIDAD,
          tiene_variantes: false,
          tiene_vencimiento: false,
          es_fraccionable: false,
          categoria_id: categoria.id,
          marca_id: null,
        }),
      );
    }

    let productoSucursal = await productoSucursalRepo.findOne({
      where: { producto_id: producto.id, sucursal_id: sucursal.id },
    });
    if (!productoSucursal) {
      productoSucursal = await productoSucursalRepo.save(
        productoSucursalRepo.create({
          producto_id: producto.id,
          sucursal_id: sucursal.id,
          activo: true,
        }),
      );
    } else if (!productoSucursal.activo) {
      productoSucursal.activo = true;
      await productoSucursalRepo.save(productoSucursal);
    }

    let stock = await stockRepo.findOne({
      where: {
        producto_id: producto.id,
        variante_id: IsNull(),
        sucursal_id: sucursal.id,
      },
    });
    if (!stock) {
      stock = stockRepo.create({
        producto_id: producto.id,
        variante_id: null,
        sucursal_id: sucursal.id,
        cantidad: 50,
        cantidad_minima: 1,
      });
    }
    stock.cantidad = Math.max(Number(stock.cantidad ?? 0), 50);
    await stockRepo.save(stock);

    const cajaService = app.get(CajaService);
    const posVentasService = app.get(PosVentasService);
    const cotizacionesService = app.get(CotizacionesService);
    const notasCreditoService = app.get(NotasCreditoService);
    const facturacionService = app.get(FacturacionService);
    const despachosService = app.get(DespachosService);

    let caja = await cajaService.findAbiertaPorEmpleado(sucursal.id, empleado.id);
    if (!caja) {
      caja = await cajaService.abrir(sucursal.id, empleado.id, {
        monto_inicial: 1000,
        descripcion: 'Smoke POS apertura',
      });
    }

    const ventaCompleta = await posVentasService.ventaCompleta(
      sucursal.id,
      empleado.id,
      {
        cliente_id: null,
        empleado_vendedor_id: empleado.id,
        observaciones: 'Smoke POS venta completa',
        items: [
          {
            producto_id: producto.id,
            cantidad: 1,
            precio_unitario: 100,
          },
        ],
        cobro: {
          caja_id: caja.id,
          pagos: [
            {
              tipo: TipoPagoPos.EFECTIVO,
              medio_pago_id: efectivo.id,
              monto: 100,
            },
          ],
        },
        emitir_comprobante: true,
        comprobante_fiscal: {
          tipo: TipoEmisionFiscal.TICKET,
        },
      },
    );

    if (ventaCompleta.venta.estado !== EstadoComprobante.COBRADA) {
      throw new Error('La venta completa no quedo COBRADA');
    }
    if (!ventaCompleta.comprobanteFiscal) {
      throw new Error('No se emitio ticket en venta completa');
    }

    const ventaPendiente = await posVentasService.crearVenta(
      sucursal.id,
      empleado.id,
      {
        cliente_id: null,
        empleado_vendedor_id: empleado.id,
        observaciones: 'Smoke POS venta pendiente para cancelar',
        items: [
          {
            producto_id: producto.id,
            cantidad: 1,
            precio_unitario: 100,
          },
        ],
      },
    );
    const ventaCancelada = await posVentasService.cancelarVenta(
      ventaPendiente.id,
      sucursal.id,
      empleado.id,
      { motivo: 'Smoke POS cancelar venta pendiente' },
    );
    if (ventaCancelada.estado !== EstadoComprobante.CANCELADA) {
      throw new Error('No se pudo cancelar una venta pendiente');
    }

    const ticketAnulado = await facturacionService.anular(
      ventaCompleta.comprobanteFiscal.id,
      sucursal.id,
      { motivo: 'Smoke POS anula ticket' },
    );
    if (ticketAnulado.estado !== EstadoComprobante.ANULADO) {
      throw new Error('No se pudo anular el ticket');
    }

    const ticketReemitido = await facturacionService.emitir(
      sucursal.id,
      empleado.id,
      {
        venta_id: ventaCompleta.venta.id,
        tipo: TipoEmisionFiscal.TICKET,
        observaciones: 'Smoke POS ticket reemitido',
      },
    );

    const despacho = await despachosService.crearDesdeComprobante(
      sucursal.id,
      empleado.id,
      {
        comprobante_id: ventaCompleta.venta.id,
        observaciones: 'Smoke POS despacho pendiente',
      },
    );
    const despachoAnulado = await despachosService.anular(
      despacho.id,
      sucursal.id,
      empleado.id,
      { motivo: 'Smoke POS anula despacho pendiente' },
    );
    if (despachoAnulado.estado !== EstadoDespacho.ANULADO) {
      throw new Error('No se pudo anular el despacho pendiente');
    }

    const cotizacion = await cotizacionesService.create(sucursal.id, empleado.id, {
      cliente_id: null,
      empleado_vendedor_id: empleado.id,
      observaciones: 'Smoke POS cotizacion',
      items: [
        {
          producto_id: producto.id,
          cantidad: 1,
          precio_unitario: 100,
        },
      ],
    });
    await cotizacionesService.aceptar(cotizacion.id, sucursal.id, {});
    const ventaDesdeCotizacion = await cotizacionesService.convertirEnVenta(
      cotizacion.id,
      sucursal.id,
      empleado.id,
      {},
    );
    if (ventaDesdeCotizacion.estado !== EstadoComprobante.PENDIENTE_COBRO) {
      throw new Error('La cotizacion no se convirtio en venta pendiente');
    }

    const nota = await posVentasService.devolverVenta(ventaCompleta.venta.id, sucursal.id, empleado.id, {
      destino: DestinoNotaCredito.SOLO_EMITIR,
      reingresar_stock: true,
      items: [
        {
          comprobante_item_id: ventaCompleta.venta.items[0].id,
          cantidad: 1,
        },
      ],
      observaciones: 'Smoke POS nota credito',
    });
    if (nota.tipo !== 'NOTA_CREDITO') {
      throw new Error('No se genero nota de credito');
    }

    const fiscales = await facturacionService.findByVenta(
      sucursal.id,
      ventaCompleta.venta.id,
    );
    if (!fiscales.length) {
      throw new Error('No se encontro comprobante fiscal emitido');
    }

    const stockFinal = await stockRepo.findOneOrFail({
      where: {
        producto_id: producto.id,
        variante_id: IsNull(),
        sucursal_id: sucursal.id,
      },
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          sucursal: sucursal.nombre,
          caja: caja.id,
          venta: {
            id: ventaCompleta.venta.id,
            numero: ventaCompleta.venta.numero,
            estado: ventaCompleta.venta.estado,
            total: ventaCompleta.venta.total,
          },
          ticket: {
            id: ticketReemitido.id,
            numero: ticketReemitido.numero,
            tipo: ticketReemitido.tipo,
            anulado_previo: ticketAnulado.numero,
          },
          venta_cancelada: {
            id: ventaCancelada.id,
            numero: ventaCancelada.numero,
            estado: ventaCancelada.estado,
          },
          despacho_anulado: {
            id: despachoAnulado.id,
            estado: despachoAnulado.estado,
          },
          cotizacion: {
            id: cotizacion.id,
            numero: cotizacion.numero,
            venta_id: ventaDesdeCotizacion.id,
          },
          nota_credito: {
            id: nota.id,
            numero: nota.numero,
            estado: nota.estado,
          },
          stock_final: stockFinal.cantidad,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
