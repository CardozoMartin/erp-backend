import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EstadoComprobante,
  TipoComprobante,
} from 'src/comprobantes/entities/comprobante.entity';
import { ComprobanteItem } from 'src/comprobantes/entities/comprobante-item.entity';
import { Comprobante } from 'src/comprobantes/entities/comprobante.entity';
import { Caja } from 'src/caja/entities/caja.entity';
import {
  MovimientoCaja,
  TipoMovimientoCaja,
} from 'src/caja/entities/movimiento-caja.entity';
import { Empleado } from 'src/empleados/entities/empleado.entity';
import { PagoPos } from 'src/pagos-pos/entities/pago-pos.entity';
import { Producto } from 'src/producto/entities/producto.entity';
import { StockMovimiento } from 'src/stock-movimientos/entities/stock-movimiento.entity';
import { ObjectLiteral, SelectQueryBuilder, Repository } from 'typeorm';
import { ReportePosQueryDto } from './dto/reporte-pos-query.dto';

@Injectable()
export class ReportesPosService {
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
    @InjectRepository(Caja)
    private readonly cajaRepo: Repository<Caja>,
    @InjectRepository(MovimientoCaja)
    private readonly movimientoCajaRepo: Repository<MovimientoCaja>,
    @InjectRepository(StockMovimiento)
    private readonly stockMovimientoRepo: Repository<StockMovimiento>,
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
      .andWhere('comprobante.tipo = :tipoNota', {
        tipoNota: TipoComprobante.NOTA_CREDITO,
      })
      .andWhere('comprobante.estado != :anulado', {
        anulado: EstadoComprobante.ANULADO,
      })
      .select('COUNT(comprobante.id)', 'cantidad_notas')
      .addSelect('COALESCE(SUM(comprobante.total), 0)', 'total_notas')
      .getRawOne();

    const pagos = await this.basePagos(sucursalId, query)
      .select('COALESCE(SUM(pago.monto + pago.recargo_monto), 0)', 'total_cobrado')
      .getRawOne();

    const stockSalidas = await this.baseStock(sucursalId, query)
      .andWhere('movimiento.tipo IN (:...tipos)', {
        tipos: ['SALIDA', 'DESPACHO'],
      })
      .select('COALESCE(SUM(movimiento.cantidad), 0)', 'cantidad')
      .getRawOne();

    return {
      periodo: this.periodo(query),
      ventas: {
        cantidad: Number(ventas?.cantidad_ventas ?? 0),
        subtotal: this.number(ventas?.subtotal),
        descuentos: this.number(ventas?.descuentos),
        recargos: this.number(ventas?.recargos),
        total: this.number(ventas?.total),
      },
      cobros: {
        total: this.number(pagos?.total_cobrado),
      },
      notas_credito: {
        cantidad: Number(notas?.cantidad_notas ?? 0),
        total: this.number(notas?.total_notas),
      },
      stock: {
        unidades_salidas: this.number(stockSalidas?.cantidad),
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
      total: this.number(row.total),
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
      monto: this.number(row.monto),
      recargos: this.number(row.recargos),
      total: this.number(row.total),
    }));
  }

  async productos(sucursalId: string, query: ReportePosQueryDto) {
    const rows = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.comprobante', 'comprobante')
      .leftJoin(Producto, 'producto', 'producto.id = item.producto_id')
      .where('comprobante.sucursal_id = :sucursalId', { sucursalId })
      .andWhere('comprobante.tipo = :tipoVenta', {
        tipoVenta: TipoComprobante.VENTA,
      })
      .andWhere('comprobante.estado = :estado', {
        estado: EstadoComprobante.COBRADA,
      })
      .andWhere('item.producto_id IS NOT NULL')
      .select('item.producto_id', 'producto_id')
      .addSelect('COALESCE(producto.nombre, item.descripcion)', 'producto')
      .addSelect('COALESCE(SUM(item.cantidad), 0)', 'cantidad')
      .addSelect('COALESCE(SUM(item.subtotal), 0)', 'total')
      .addSelect('COALESCE(SUM(item.cantidad * producto.precio_costo), 0)', 'costo')
      .groupBy('item.producto_id')
      .addGroupBy('producto.nombre')
      .orderBy('cantidad', 'DESC');

    this.aplicarFechas(rows, query, 'comprobante.created_at');
    this.aplicarFiltrosVenta(rows, query);

    const result = await rows.getRawMany();
    return result.map((row) => {
      const total = this.number(row.total);
      const costo = this.number(row.costo);
      return {
        producto_id: row.producto_id,
        producto: row.producto,
        cantidad: this.number(row.cantidad),
        total,
        costo,
        margen: this.round(total - costo),
        margen_porcentaje: total > 0 ? this.round(((total - costo) / total) * 100) : 0,
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
      total: this.number(row.total),
    }));
  }

  async cajas(sucursalId: string, query: ReportePosQueryDto) {
    const rows = await this.cajaRepo
      .createQueryBuilder('caja')
      .leftJoin(MovimientoCaja, 'movimiento', 'movimiento.caja_id = caja.id')
      .leftJoin(Empleado, 'empleado', 'empleado.id = caja.empleado_id')
      .where('caja.sucursal_id = :sucursalId', { sucursalId })
      .select('caja.id', 'caja_id')
      .addSelect('caja.estado', 'estado')
      .addSelect('caja.empleado_id', 'empleado_id')
      .addSelect('COALESCE(empleado.nombreCompleto, "Sin empleado")', 'empleado')
      .addSelect('caja.fecha_apertura', 'fecha_apertura')
      .addSelect('caja.fecha_cierre', 'fecha_cierre')
      .addSelect('caja.monto_inicial', 'monto_inicial')
      .addSelect('caja.monto_final_declarado', 'monto_final_declarado')
      .addSelect('caja.monto_final_calculado', 'monto_final_calculado')
      .addSelect('caja.diferencia', 'diferencia')
      .addSelect(
        `COALESCE(SUM(CASE WHEN movimiento.tipo = '${TipoMovimientoCaja.COBRO}' THEN movimiento.monto ELSE 0 END), 0)`,
        'cobros',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN movimiento.tipo = '${TipoMovimientoCaja.EGRESO}' THEN movimiento.monto ELSE 0 END), 0)`,
        'egresos',
      )
      .groupBy('caja.id')
      .addGroupBy('empleado.nombreCompleto')
      .orderBy('caja.fecha_apertura', 'DESC');

    this.aplicarFechas(rows, query, 'caja.fecha_apertura');
    if (query.caja_id) rows.andWhere('caja.id = :cajaId', { cajaId: query.caja_id });
    if (query.empleado_id) {
      rows.andWhere('caja.empleado_id = :empleadoId', {
        empleadoId: query.empleado_id,
      });
    }

    const result = await rows.getRawMany();
    return result.map((row) => ({
      caja_id: row.caja_id,
      estado: row.estado,
      empleado_id: row.empleado_id,
      empleado: row.empleado,
      fecha_apertura: row.fecha_apertura,
      fecha_cierre: row.fecha_cierre,
      monto_inicial: this.number(row.monto_inicial),
      cobros: this.number(row.cobros),
      egresos: this.number(row.egresos),
      monto_final_declarado: this.nullableNumber(row.monto_final_declarado),
      monto_final_calculado: this.nullableNumber(row.monto_final_calculado),
      diferencia: this.nullableNumber(row.diferencia),
    }));
  }

  async stock(sucursalId: string, query: ReportePosQueryDto) {
    const rows = await this.baseStock(sucursalId, query)
      .leftJoin(Producto, 'producto', 'producto.id = movimiento.producto_id')
      .select('movimiento.producto_id', 'producto_id')
      .addSelect('COALESCE(producto.nombre, movimiento.producto_id)', 'producto')
      .addSelect('movimiento.tipo', 'tipo')
      .addSelect('movimiento.origen', 'origen')
      .addSelect('COUNT(movimiento.id)', 'movimientos')
      .addSelect('COALESCE(SUM(movimiento.cantidad), 0)', 'cantidad')
      .groupBy('movimiento.producto_id')
      .addGroupBy('producto.nombre')
      .addGroupBy('movimiento.tipo')
      .addGroupBy('movimiento.origen')
      .orderBy('cantidad', 'DESC')
      .getRawMany();

    return rows.map((row) => ({
      producto_id: row.producto_id,
      producto: row.producto,
      tipo: row.tipo,
      origen: row.origen,
      movimientos: Number(row.movimientos),
      cantidad: this.number(row.cantidad),
    }));
  }

  private baseVentas(sucursalId: string, query: ReportePosQueryDto) {
    const qb = this.baseComprobantes(sucursalId, query)
      .andWhere('comprobante.tipo = :tipoVenta', {
        tipoVenta: TipoComprobante.VENTA,
      })
      .andWhere('comprobante.estado = :estadoVenta', {
        estadoVenta: EstadoComprobante.COBRADA,
      });
    this.aplicarFiltrosVenta(qb, query);
    return qb;
  }

  private baseComprobantes(sucursalId: string, query: ReportePosQueryDto) {
    const qb = this.comprobanteRepo
      .createQueryBuilder('comprobante')
      .where('comprobante.sucursal_id = :sucursalId', { sucursalId });
    this.aplicarFechas(qb, query, 'comprobante.created_at');
    return qb;
  }

  private basePagos(sucursalId: string, query: ReportePosQueryDto) {
    const qb = this.pagoRepo
      .createQueryBuilder('pago')
      .innerJoin('pago.comprobante', 'comprobante')
      .where('comprobante.sucursal_id = :sucursalId', { sucursalId })
      .andWhere('comprobante.tipo = :tipoVenta', {
        tipoVenta: TipoComprobante.VENTA,
      })
      .andWhere('comprobante.estado = :estadoVenta', {
        estadoVenta: EstadoComprobante.COBRADA,
      });
    this.aplicarFechas(qb, query, 'pago.created_at');
    if (query.caja_id) qb.andWhere('pago.caja_id = :cajaId', { cajaId: query.caja_id });
    if (query.empleado_id) {
      qb.andWhere('pago.empleado_id = :empleadoId', {
        empleadoId: query.empleado_id,
      });
    }
    return qb;
  }

  private baseStock(sucursalId: string, query: ReportePosQueryDto) {
    const qb = this.stockMovimientoRepo
      .createQueryBuilder('movimiento')
      .where('movimiento.sucursal_id = :sucursalId', { sucursalId });
    this.aplicarFechas(qb, query, 'movimiento.created_at');
    if (query.empleado_id) {
      qb.andWhere('movimiento.empleado_id = :empleadoId', {
        empleadoId: query.empleado_id,
      });
    }
    return qb;
  }

  private aplicarFiltrosVenta(
    qb: SelectQueryBuilder<Comprobante> | SelectQueryBuilder<ComprobanteItem>,
    query: ReportePosQueryDto,
  ) {
    if (query.caja_id) {
      qb.andWhere('comprobante.caja_id = :cajaId', { cajaId: query.caja_id });
    }
    if (query.empleado_id) {
      qb.andWhere('comprobante.empleado_vendedor_id = :empleadoId', {
        empleadoId: query.empleado_id,
      });
    }
  }

  private aplicarFechas<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    query: ReportePosQueryDto,
    campo: string,
  ) {
    const { desde, hasta } = this.periodo(query);
    qb.andWhere(`${campo} >= :desde`, { desde });
    qb.andWhere(`${campo} <= :hasta`, { hasta });
  }

  private periodo(query: ReportePosQueryDto): { desde: Date; hasta: Date } {
    const desde = query.desde ? new Date(query.desde) : new Date();
    const hasta = query.hasta ? new Date(query.hasta) : new Date();

    if (!query.desde) desde.setHours(0, 0, 0, 0);
    if (!query.hasta) hasta.setHours(23, 59, 59, 999);

    return { desde, hasta };
  }

  private number(value: unknown): number {
    return this.round(Number(value ?? 0));
  }

  private nullableNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    return this.number(value);
  }

  private round(value: number): number {
    return Number(Number(value).toFixed(2));
  }
}
