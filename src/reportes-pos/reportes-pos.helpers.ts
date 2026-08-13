import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { Comprobante } from 'src/comprobantes/entities/comprobante.entity';
import { ComprobanteItem } from 'src/comprobantes/entities/comprobante-item.entity';
import { Caja } from 'src/caja/entities/caja.entity';
import { ReportePosQueryDto } from './dto/reporte-pos-query.dto';

export function aplicarFechas<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  query: ReportePosQueryDto,
  campo: string,
) {
  const { desde, hasta } = calcularPeriodo(query);
  qb.andWhere(`${campo} >= :desde`, { desde });
  qb.andWhere(`${campo} <= :hasta`, { hasta });
}

export function aplicarFiltrosVenta(
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

export function calcularPeriodo(query: ReportePosQueryDto): { desde: Date; hasta: Date } {
  const desde = query.desde ? new Date(query.desde) : new Date();
  const hasta = query.hasta ? new Date(query.hasta) : new Date();

  if (!query.desde || esFechaSinHora(query.desde)) desde.setHours(0, 0, 0, 0);
  if (!query.hasta || esFechaSinHora(query.hasta)) hasta.setHours(23, 59, 59, 999);

  return { desde, hasta };
}

function esFechaSinHora(value?: string): boolean {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function aplicarRangoCajas(qb: SelectQueryBuilder<Caja>, query: ReportePosQueryDto) {
  const { desde, hasta } = calcularPeriodo(query);
  qb.andWhere('caja.fecha_apertura <= :hasta', { hasta });
  qb.andWhere('(caja.fecha_cierre IS NULL OR caja.fecha_cierre >= :desde)', { desde });
}

export function toNumber(value: unknown): number {
  return round(Number(value ?? 0));
}

export function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return toNumber(value);
}

export function round(value: number): number {
  return Number(Number(value).toFixed(2));
}
