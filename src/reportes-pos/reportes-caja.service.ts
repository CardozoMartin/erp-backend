import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Caja, EstadoCaja } from 'src/caja/entities/caja.entity';
import {
  MovimientoCaja,
  TipoMovimientoCaja,
} from 'src/caja/entities/movimiento-caja.entity';
import {
  Comprobante,
  EstadoComprobante,
  TipoComprobante,
} from 'src/comprobantes/entities/comprobante.entity';
import { ComprobanteItem } from 'src/comprobantes/entities/comprobante-item.entity';
import { Empleado } from 'src/empleados/entities/empleado.entity';
import { Producto } from 'src/producto/entities/producto.entity';
import { StockMovimiento } from 'src/stock-movimientos/entities/stock-movimiento.entity';
import { ReportePosQueryDto } from './dto/reporte-pos-query.dto';
import { aplicarRangoCajas, toNumber, nullableNumber, round } from './reportes-pos.helpers';

@Injectable()
export class ReportesCajaService {
  constructor(
    @InjectRepository(Caja)
    private readonly cajaRepo: Repository<Caja>,
    @InjectRepository(MovimientoCaja)
    private readonly movimientoCajaRepo: Repository<MovimientoCaja>,
    @InjectRepository(Comprobante)
    private readonly comprobanteRepo: Repository<Comprobante>,
    @InjectRepository(ComprobanteItem)
    private readonly itemRepo: Repository<ComprobanteItem>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(StockMovimiento)
    private readonly stockMovimientoRepo: Repository<StockMovimiento>,
  ) {}

  async cajas(sucursalId: string, query: ReportePosQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const skip = (page - 1) * limit;

    const qb = this.cajaRepo
      .createQueryBuilder('caja')
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
      .groupBy('caja.id')
      .addGroupBy('empleado.nombreCompleto')
      .orderBy('caja.fecha_apertura', 'DESC');

    aplicarRangoCajas(qb, query);
    if (query.caja_id) qb.andWhere('caja.id = :cajaId', { cajaId: query.caja_id });
    if (query.empleado_id) qb.andWhere('caja.empleado_id = :empleadoId', { empleadoId: query.empleado_id });

    const total = await qb.getCount();
    const result = await qb.skip(skip).take(limit).getRawMany();

    const cajaIds = result.map((row) => row.caja_id).filter(Boolean);
    const [movimientosByCaja, ventasByCaja, notasByCaja, stockByCaja] = await Promise.all([
      this.movimientosPorCaja(cajaIds),
      this.ventasPorCaja(cajaIds),
      this.notasCreditoPorCaja(cajaIds),
      this.stockVendidoPorCaja(cajaIds),
    ]);

    const data = result.map((row) => ({
      caja_id: row.caja_id,
      estado: row.estado,
      empleado_id: row.empleado_id,
      empleado: row.empleado,
      fecha_apertura: row.fecha_apertura,
      fecha_cierre: row.fecha_cierre,
      monto_inicial: toNumber(row.monto_inicial),
      ventas: ventasByCaja.get(row.caja_id)?.ventas ?? 0,
      total_vendido: ventasByCaja.get(row.caja_id)?.total ?? 0,
      costo_vendido: ventasByCaja.get(row.caja_id)?.costo ?? 0,
      ganancia_estimada: ventasByCaja.get(row.caja_id)?.ganancia ?? 0,
      margen_porcentaje: ventasByCaja.get(row.caja_id)?.margen_porcentaje ?? 0,
      reposicion_estimada: ventasByCaja.get(row.caja_id)?.costo ?? 0,
      unidades_vendidas: ventasByCaja.get(row.caja_id)?.unidades ?? 0,
      stock_salidas: stockByCaja.get(row.caja_id)?.salidas ?? 0,
      cobros: movimientosByCaja.get(row.caja_id)?.cobros ?? 0,
      ingresos_manuales: movimientosByCaja.get(row.caja_id)?.ingresos_manuales ?? 0,
      egresos: movimientosByCaja.get(row.caja_id)?.egresos ?? 0,
      ajustes: movimientosByCaja.get(row.caja_id)?.ajustes ?? 0,
      dinero_esperado: movimientosByCaja.get(row.caja_id)?.dinero_esperado ?? toNumber(row.monto_inicial),
      notas_credito: notasByCaja.get(row.caja_id)?.cantidad ?? 0,
      total_notas_credito: notasByCaja.get(row.caja_id)?.total ?? 0,
      monto_final_declarado: nullableNumber(row.monto_final_declarado),
      monto_final_calculado: nullableNumber(row.monto_final_calculado),
      diferencia: nullableNumber(row.diferencia),
    }));

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async diferenciasCaja(sucursalId: string, query: ReportePosQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const skip = (page - 1) * limit;

    const qb = this.cajaRepo
      .createQueryBuilder('caja')
      .leftJoin(Empleado, 'empleado', 'empleado.id = caja.empleado_id')
      .where('caja.sucursal_id = :sucursalId', { sucursalId })
      .andWhere('caja.estado = :cerrada', { cerrada: EstadoCaja.CERRADA })
      .andWhere('caja.diferencia IS NOT NULL')
      .andWhere('caja.diferencia != 0')
      .select('caja.id', 'caja_id')
      .addSelect('COALESCE(empleado.nombreCompleto, "Sin empleado")', 'empleado')
      .addSelect('caja.empleado_id', 'empleado_id')
      .addSelect('caja.fecha_apertura', 'fecha_apertura')
      .addSelect('caja.fecha_cierre', 'fecha_cierre')
      .addSelect('caja.monto_inicial', 'monto_inicial')
      .addSelect('caja.monto_final_declarado', 'monto_final_declarado')
      .addSelect('caja.monto_final_calculado', 'monto_final_calculado')
      .addSelect('caja.diferencia', 'diferencia')
      .groupBy('caja.id')
      .addGroupBy('empleado.nombreCompleto')
      .orderBy('ABS(caja.diferencia)', 'DESC');

    aplicarRangoCajas(qb, query);
    if (query.empleado_id) qb.andWhere('caja.empleado_id = :empleadoId', { empleadoId: query.empleado_id });

    const total = await qb.getCount();
    const rows = await qb.skip(skip).take(limit).getRawMany();

    const data = rows.map((row) => ({
      caja_id: row.caja_id,
      empleado: row.empleado,
      empleado_id: row.empleado_id,
      fecha_apertura: row.fecha_apertura,
      fecha_cierre: row.fecha_cierre,
      monto_inicial: toNumber(row.monto_inicial),
      monto_final_declarado: nullableNumber(row.monto_final_declarado),
      monto_final_calculado: nullableNumber(row.monto_final_calculado),
      diferencia: nullableNumber(row.diferencia),
    }));

    const resumen = {
      total_diferencias: rows.reduce((acc, r) => acc + Math.abs(toNumber(r.diferencia)), 0),
      diferencias_positivas: rows.filter((r) => toNumber(r.diferencia) > 0).length,
      diferencias_negativas: rows.filter((r) => toNumber(r.diferencia) < 0).length,
    };

    return { data, resumen, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  private async movimientosPorCaja(cajaIds: string[]) {
    const map = new Map<string, { cobros: number; ingresos_manuales: number; egresos: number; ajustes: number; dinero_esperado: number }>();
    if (!cajaIds.length) return map;

    const rows = await this.movimientoCajaRepo
      .createQueryBuilder('movimiento')
      .where('movimiento.caja_id IN (:...cajaIds)', { cajaIds })
      .select('movimiento.caja_id', 'caja_id')
      .addSelect(`COALESCE(SUM(CASE WHEN movimiento.tipo = '${TipoMovimientoCaja.APERTURA}' THEN movimiento.monto ELSE 0 END), 0)`, 'apertura')
      .addSelect(`COALESCE(SUM(CASE WHEN movimiento.tipo = '${TipoMovimientoCaja.COBRO}' THEN movimiento.monto ELSE 0 END), 0)`, 'cobros')
      .addSelect(`COALESCE(SUM(CASE WHEN movimiento.tipo = '${TipoMovimientoCaja.INGRESO_MANUAL}' THEN movimiento.monto ELSE 0 END), 0)`, 'ingresos_manuales')
      .addSelect(`COALESCE(SUM(CASE WHEN movimiento.tipo = '${TipoMovimientoCaja.EGRESO}' THEN movimiento.monto ELSE 0 END), 0)`, 'egresos')
      .addSelect(`COALESCE(SUM(CASE WHEN movimiento.tipo = '${TipoMovimientoCaja.AJUSTE}' THEN movimiento.monto ELSE 0 END), 0)`, 'ajustes')
      .groupBy('movimiento.caja_id')
      .getRawMany();

    for (const row of rows) {
      const apertura = toNumber(row.apertura);
      const cobros = toNumber(row.cobros);
      const ingresosManuales = toNumber(row.ingresos_manuales);
      const egresos = toNumber(row.egresos);
      const ajustes = toNumber(row.ajustes);
      map.set(row.caja_id, {
        cobros,
        ingresos_manuales: ingresosManuales,
        egresos,
        ajustes,
        dinero_esperado: round(apertura + cobros + ingresosManuales + ajustes - egresos),
      });
    }
    return map;
  }

  private async ventasPorCaja(cajaIds: string[]) {
    const map = new Map<string, { ventas: number; total: number; costo: number; ganancia: number; margen_porcentaje: number; unidades: number }>();
    if (!cajaIds.length) return map;

    const rows = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.comprobante', 'comprobante')
      .leftJoin(Producto, 'producto', 'producto.id = item.producto_id')
      .where('comprobante.caja_id IN (:...cajaIds)', { cajaIds })
      .andWhere('comprobante.tipo = :tipoVenta', { tipoVenta: TipoComprobante.VENTA })
      .andWhere('comprobante.estado = :estado', { estado: EstadoComprobante.COBRADA })
      .select('comprobante.caja_id', 'caja_id')
      .addSelect('COUNT(DISTINCT comprobante.id)', 'ventas')
      .addSelect('COALESCE(SUM(item.subtotal), 0)', 'total')
      .addSelect('COALESCE(SUM(item.cantidad * producto.precio_costo), 0)', 'costo')
      .addSelect('COALESCE(SUM(item.cantidad), 0)', 'unidades')
      .groupBy('comprobante.caja_id')
      .getRawMany();

    for (const row of rows) {
      const total = toNumber(row.total);
      const costo = toNumber(row.costo);
      const ganancia = round(total - costo);
      map.set(row.caja_id, {
        ventas: Number(row.ventas ?? 0),
        total,
        costo,
        ganancia,
        margen_porcentaje: total > 0 ? round((ganancia / total) * 100) : 0,
        unidades: toNumber(row.unidades),
      });
    }
    return map;
  }

  private async notasCreditoPorCaja(cajaIds: string[]) {
    const map = new Map<string, { cantidad: number; total: number }>();
    if (!cajaIds.length) return map;

    const rows = await this.comprobanteRepo
      .createQueryBuilder('comprobante')
      .where('comprobante.caja_id IN (:...cajaIds)', { cajaIds })
      .andWhere('comprobante.tipo = :tipoNota', { tipoNota: TipoComprobante.NOTA_CREDITO })
      .andWhere('comprobante.estado != :anulado', { anulado: EstadoComprobante.ANULADO })
      .select('comprobante.caja_id', 'caja_id')
      .addSelect('COUNT(comprobante.id)', 'cantidad')
      .addSelect('COALESCE(SUM(comprobante.total), 0)', 'total')
      .groupBy('comprobante.caja_id')
      .getRawMany();

    for (const row of rows) {
      map.set(row.caja_id, { cantidad: Number(row.cantidad ?? 0), total: toNumber(row.total) });
    }
    return map;
  }

  private async stockVendidoPorCaja(cajaIds: string[]) {
    const map = new Map<string, { salidas: number }>();
    if (!cajaIds.length) return map;

    const rows = await this.stockMovimientoRepo
      .createQueryBuilder('movimiento')
      .innerJoin(Comprobante, 'comprobante', 'comprobante.id = movimiento.comprobante_id')
      .where('comprobante.caja_id IN (:...cajaIds)', { cajaIds })
      .andWhere('movimiento.tipo IN (:...tipos)', { tipos: ['SALIDA', 'DESPACHO'] })
      .select('comprobante.caja_id', 'caja_id')
      .addSelect('COALESCE(SUM(movimiento.cantidad), 0)', 'salidas')
      .groupBy('comprobante.caja_id')
      .getRawMany();

    for (const row of rows) {
      map.set(row.caja_id, { salidas: toNumber(row.salidas) });
    }
    return map;
  }
}
