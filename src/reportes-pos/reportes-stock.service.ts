import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Producto } from 'src/producto/entities/producto.entity';
import { StockMovimiento } from 'src/stock-movimientos/entities/stock-movimiento.entity';
import { ReportePosQueryDto } from './dto/reporte-pos-query.dto';
import { aplicarFechas, toNumber } from './reportes-pos.helpers';

@Injectable()
export class ReportesStockService {
  constructor(
    @InjectRepository(StockMovimiento)
    private readonly stockMovimientoRepo: Repository<StockMovimiento>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
  ) {}

  async stock(sucursalId: string, query: ReportePosQueryDto) {
    const qb = this.baseStock(sucursalId, query)
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
      .orderBy('cantidad', 'DESC');

    const rows = await qb.getRawMany();
    return rows.map((row) => ({
      producto_id: row.producto_id,
      producto: row.producto,
      tipo: row.tipo,
      origen: row.origen,
      movimientos: Number(row.movimientos),
      cantidad: toNumber(row.cantidad),
    }));
  }

  async salidasPorCaja(sucursalId: string, query: ReportePosQueryDto) {
    return this.baseStock(sucursalId, query)
      .andWhere('movimiento.tipo IN (:...tipos)', { tipos: ['SALIDA', 'DESPACHO'] })
      .select('COALESCE(SUM(movimiento.cantidad), 0)', 'cantidad')
      .getRawOne();
  }

  baseStock(sucursalId: string, query: ReportePosQueryDto) {
    const qb = this.stockMovimientoRepo
      .createQueryBuilder('movimiento')
      .where('movimiento.sucursal_id = :sucursalId', { sucursalId });
    aplicarFechas(qb, query, 'movimiento.created_at');
    if (query.empleado_id) {
      qb.andWhere('movimiento.empleado_id = :empleadoId', { empleadoId: query.empleado_id });
    }
    return qb;
  }
}
