import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EstadoComprobante,
  TipoComprobante,
  Comprobante,
} from 'src/comprobantes/entities/comprobante.entity';
import { ComprobanteItem } from 'src/comprobantes/entities/comprobante-item.entity';
import { Empleado } from 'src/empleados/entities/empleado.entity';
import { PagoPos } from 'src/pagos-pos/entities/pago-pos.entity';
import { Producto } from 'src/producto/entities/producto.entity';
import { ReportePosQueryDto } from './dto/reporte-pos-query.dto';
import {
  aplicarFechas,
  aplicarFiltrosVenta,
  calcularPeriodo,
  toNumber,
  round,
} from './reportes-pos.helpers';

const ESTADOS_VENDIDOS = [
  EstadoComprobante.COBRADA,
  EstadoComprobante.EMITIDA,
  EstadoComprobante.ENTREGADO,
  EstadoComprobante.ENTREGADO_PARCIAL,
];

@Injectable()
export class ReportesVentasService {
  constructor(
    @InjectRepository(Comprobante)
    private readonly comprobanteRepo: Repository<Comprobante>,
    @InjectRepository(ComprobanteItem)
    private readonly itemRepo: Repository<ComprobanteItem>,
    @InjectRepository(PagoPos)
    private readonly pagoRepo: Repository<PagoPos>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(Empleado)
    private readonly empleadoRepo: Repository<Empleado>,
  ) {}

  async resumen(sucursalId: string, query: ReportePosQueryDto) {
    const ventas = await this.baseVentas(sucursalId, query)
      .select('COUNT(comprobante.id)', 'cantidad_ventas')
      .addSelect('COALESCE(SUM(comprobante.subtotal), 0)', 'subtotal')
      .addSelect('COALESCE(SUM(comprobante.descuento_total), 0)', 'descuentos')
      .addSelect('COALESCE(SUM(comprobante.recargo_total), 0)', 'recargos')
      .addSelect('COALESCE(SUM(comprobante.total), 0)', 'total')
      .getRawOne();

    const notas = await this.baseComprobantes(sucursalId, query)
      .andWhere('comprobante.tipo = :tipoNota', { tipoNota: TipoComprobante.NOTA_CREDITO })
      .andWhere('comprobante.estado != :anulado', { anulado: EstadoComprobante.ANULADO })
      .select('COUNT(comprobante.id)', 'cantidad_notas')
      .addSelect('COALESCE(SUM(comprobante.total), 0)', 'total_notas')
      .getRawOne();

    const pagos = await this.basePagos(sucursalId, query)
      .select('COALESCE(SUM(pago.monto + pago.recargo_monto), 0)', 'total_cobrado')
      .getRawOne();

    const rentabilidad = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.comprobante', 'comprobante')
      .leftJoin(Producto, 'producto', 'producto.id = item.producto_id')
      .where('comprobante.sucursal_id = :sucursalId', { sucursalId })
      .andWhere('comprobante.tipo = :tipoVenta', { tipoVenta: TipoComprobante.VENTA })
      .andWhere('comprobante.estado = :estadoVenta', { estadoVenta: EstadoComprobante.COBRADA })
      .select('COALESCE(SUM(item.cantidad * producto.precio_costo), 0)', 'costo')
      .addSelect('COALESCE(SUM(item.cantidad), 0)', 'unidades')
      .addSelect('COALESCE(SUM(item.subtotal), 0)', 'total_items');
    aplicarFechas(rentabilidad, query, 'comprobante.created_at');
    aplicarFiltrosVenta(rentabilidad, query);
    const rentRow = await rentabilidad.getRawOne();
    const totalRent = toNumber(rentRow?.total_items);
    const costoRent = toNumber(rentRow?.costo);
    const gananciaRent = round(totalRent - costoRent);

    return {
      periodo: calcularPeriodo(query),
      ventas: {
        cantidad: Number(ventas?.cantidad_ventas ?? 0),
        subtotal: toNumber(ventas?.subtotal),
        descuentos: toNumber(ventas?.descuentos),
        recargos: toNumber(ventas?.recargos),
        total: toNumber(ventas?.total),
      },
      cobros: { total: toNumber(pagos?.total_cobrado) },
      rentabilidad: {
        costo_estimado: costoRent,
        ganancia_estimada: gananciaRent,
        margen_porcentaje: totalRent > 0 ? round((gananciaRent / totalRent) * 100) : 0,
        reposicion_estimada: costoRent,
      },
      notas_credito: {
        cantidad: Number(notas?.cantidad_notas ?? 0),
        total: toNumber(notas?.total_notas),
      },
    };
  }

  async ventasPorDia(sucursalId: string, query: ReportePosQueryDto) {
    const rows = await this.baseVentas(sucursalId, query)
      .select('DATE(comprobante.created_at)', 'fecha')
      .addSelect('COUNT(comprobante.id)', 'cantidad')
      .addSelect('COALESCE(SUM(comprobante.total), 0)', 'total')
      .groupBy('DATE(comprobante.created_at)')
      .orderBy('fecha', 'ASC')
      .getRawMany();

    return rows.map((row) => ({
      fecha: row.fecha,
      cantidad: Number(row.cantidad),
      total: toNumber(row.total),
    }));
  }

  async mediosPago(sucursalId: string, query: ReportePosQueryDto) {
    const rows = await this.basePagos(sucursalId, query)
      .leftJoin('pago.medioPago', 'medio')
      .select('pago.tipo', 'tipo')
      .addSelect('pago.medio_pago_id', 'medio_pago_id')
      .addSelect('COALESCE(medio.nombre, pago.tipo)', 'medio_pago')
      .addSelect('COUNT(pago.id)', 'cantidad')
      .addSelect('COALESCE(SUM(pago.monto), 0)', 'monto')
      .addSelect('COALESCE(SUM(pago.recargo_monto), 0)', 'recargos')
      .addSelect('COALESCE(SUM(pago.monto + pago.recargo_monto), 0)', 'total')
      .groupBy('pago.tipo')
      .addGroupBy('pago.medio_pago_id')
      .addGroupBy('medio.nombre')
      .orderBy('total', 'DESC')
      .getRawMany();

    return rows.map((row) => ({
      tipo: row.tipo,
      medio_pago_id: row.medio_pago_id,
      medio_pago: row.medio_pago,
      cantidad: Number(row.cantidad),
      monto: toNumber(row.monto),
      recargos: toNumber(row.recargos),
      total: toNumber(row.total),
    }));
  }

  async productos(sucursalId: string, query: ReportePosQueryDto) {
    const rows = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.comprobante', 'comprobante')
      .leftJoin(Producto, 'producto', 'producto.id = item.producto_id')
      .where('comprobante.sucursal_id = :sucursalId', { sucursalId })
      .andWhere('comprobante.tipo = :tipoVenta', { tipoVenta: TipoComprobante.VENTA })
      .andWhere('comprobante.estado IN (:...estadosVendidos)', { estadosVendidos: ESTADOS_VENDIDOS })
      .select('COALESCE(item.producto_id, item.descripcion)', 'producto_id')
      .addSelect('COALESCE(producto.nombre, item.descripcion)', 'producto')
      .addSelect('COALESCE(SUM(item.cantidad), 0)', 'cantidad')
      .addSelect('COALESCE(SUM(item.subtotal), 0)', 'total')
      .addSelect('COALESCE(SUM(item.cantidad * producto.precio_costo), 0)', 'costo')
      .groupBy('COALESCE(item.producto_id, item.descripcion)')
      .addGroupBy('producto.nombre')
      .addGroupBy('item.descripcion')
      .orderBy('SUM(item.subtotal)', 'DESC');

    if (!query.caja_id) aplicarFechas(rows, query, 'comprobante.created_at');
    aplicarFiltrosVenta(rows, query);

    const result = await rows.getRawMany();
    return result.map((row) => {
      const total = toNumber(row.total);
      const costo = toNumber(row.costo);
      return {
        producto_id: row.producto_id,
        producto: row.producto,
        cantidad: toNumber(row.cantidad),
        total,
        costo,
        margen: round(total - costo),
        margen_porcentaje: total > 0 ? round(((total - costo) / total) * 100) : 0,
      };
    });
  }

  async empleados(sucursalId: string, query: ReportePosQueryDto) {
    const rows = await this.baseVentas(sucursalId, query)
      .leftJoin(Empleado, 'empleado', 'empleado.id = comprobante.empleado_vendedor_id')
      .select('comprobante.empleado_vendedor_id', 'empleado_id')
      .addSelect('COALESCE(empleado.nombreCompleto, "Sin empleado")', 'empleado')
      .addSelect('COUNT(comprobante.id)', 'cantidad')
      .addSelect('COALESCE(SUM(comprobante.total), 0)', 'total')
      .groupBy('comprobante.empleado_vendedor_id')
      .addGroupBy('empleado.nombreCompleto')
      .orderBy('total', 'DESC')
      .getRawMany();

    return rows.map((row) => ({
      empleado_id: row.empleado_id,
      empleado: row.empleado,
      cantidad: Number(row.cantidad),
      total: toNumber(row.total),
    }));
  }

  async notasCredito(sucursalId: string, query: ReportePosQueryDto) {
    const rows = await this.comprobanteRepo
      .createQueryBuilder('nota')
      .leftJoin('nota.comprobanteOrigen', 'origen')
      .leftJoin(Empleado, 'cajero', 'cajero.id = nota.empleado_cajero_id')
      .leftJoin(Empleado, 'vendedor', 'vendedor.id = nota.empleado_vendedor_id')
      .where('nota.sucursal_id = :sucursalId', { sucursalId })
      .andWhere('nota.tipo = :tipo', { tipo: TipoComprobante.NOTA_CREDITO })
      .andWhere('nota.estado != :anulado', { anulado: EstadoComprobante.ANULADO })
      .select('nota.id', 'id')
      .addSelect('nota.numero', 'numero')
      .addSelect('nota.estado', 'estado')
      .addSelect('nota.total', 'total')
      .addSelect('nota.observaciones', 'observaciones')
      .addSelect('nota.created_at', 'fecha')
      .addSelect('nota.cliente_id', 'cliente_id')
      .addSelect('nota.caja_id', 'caja_id')
      .addSelect('nota.comprobante_origen_id', 'comprobante_origen_id')
      .addSelect('origen.numero', 'venta_origen_numero')
      .addSelect('origen.tipo', 'venta_origen_tipo')
      .addSelect('COALESCE(cajero.nombreCompleto, vendedor.nombreCompleto)', 'empleado')
      .orderBy('nota.created_at', 'DESC');

    aplicarFechas(rows, query, 'nota.created_at');
    if (query.caja_id) rows.andWhere('nota.caja_id = :cajaId', { cajaId: query.caja_id });
    if (query.empleado_id) {
      rows.andWhere(
        '(nota.empleado_cajero_id = :eid OR nota.empleado_vendedor_id = :eid)',
        { eid: query.empleado_id },
      );
    }

    const result = await rows.getRawMany();
    const notaIds = result.map((r) => r.id);
    const items = notaIds.length
      ? await this.itemRepo
          .createQueryBuilder('item')
          .leftJoin(Producto, 'producto', 'producto.id = item.producto_id')
          .where('item.comprobante_id IN (:...ids)', { ids: notaIds })
          .select('item.comprobante_id', 'comprobante_id')
          .addSelect('item.descripcion', 'descripcion')
          .addSelect('item.cantidad', 'cantidad')
          .addSelect('item.precio_unitario', 'precio_unitario')
          .addSelect('item.subtotal', 'subtotal')
          .getRawMany()
      : [];

    const itemsByNota = new Map<string, typeof items>();
    for (const item of items) {
      const lista = itemsByNota.get(item.comprobante_id) ?? [];
      lista.push(item);
      itemsByNota.set(item.comprobante_id, lista);
    }

    return result.map((row) => ({
      id: row.id,
      numero: row.numero,
      estado: row.estado,
      fecha: row.fecha,
      cliente_id: row.cliente_id,
      caja_id: row.caja_id,
      comprobante_origen_id: row.comprobante_origen_id,
      venta_origen_numero: row.venta_origen_numero ?? null,
      venta_origen_tipo: row.venta_origen_tipo ?? null,
      empleado: row.empleado ?? 'Sin empleado',
      observaciones: row.observaciones ?? null,
      total: toNumber(row.total),
      items: (itemsByNota.get(row.id) ?? []).map((item) => ({
        descripcion: item.descripcion,
        cantidad: toNumber(item.cantidad),
        precio_unitario: toNumber(item.precio_unitario),
        subtotal: toNumber(item.subtotal),
      })),
    }));
  }

  baseComprobantes(sucursalId: string, query: ReportePosQueryDto) {
    const qb = this.comprobanteRepo
      .createQueryBuilder('comprobante')
      .where('comprobante.sucursal_id = :sucursalId', { sucursalId });
    aplicarFechas(qb, query, 'comprobante.created_at');
    return qb;
  }

  baseVentas(sucursalId: string, query: ReportePosQueryDto) {
    const qb = this.baseComprobantes(sucursalId, query)
      .andWhere('comprobante.tipo = :tipoVenta', { tipoVenta: TipoComprobante.VENTA })
      .andWhere('comprobante.estado IN (:...estadosVendidos)', { estadosVendidos: ESTADOS_VENDIDOS });
    aplicarFiltrosVenta(qb, query);
    return qb;
  }

  basePagos(sucursalId: string, query: ReportePosQueryDto) {
    const qb = this.pagoRepo
      .createQueryBuilder('pago')
      .innerJoin('pago.comprobante', 'comprobante')
      .where('comprobante.sucursal_id = :sucursalId', { sucursalId })
      .andWhere('comprobante.tipo = :tipoVenta', { tipoVenta: TipoComprobante.VENTA })
      .andWhere('comprobante.estado = :estadoVenta', { estadoVenta: EstadoComprobante.COBRADA });
    aplicarFechas(qb, query, 'pago.created_at');
    if (query.caja_id) qb.andWhere('pago.caja_id = :cajaId', { cajaId: query.caja_id });
    if (query.empleado_id) {
      qb.andWhere('pago.empleado_id = :empleadoId', { empleadoId: query.empleado_id });
    }
    return qb;
  }
}
