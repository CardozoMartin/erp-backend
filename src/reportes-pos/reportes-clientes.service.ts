import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { CuentaCorriente } from 'src/clientes/entities/cuenta-corriente.entity';
import {
  MovimientoCuentaCorriente,
  TipoMovimientoCC,
} from 'src/clientes/entities/movimiento-cuenta-corriente.entity';
import { ReportePosQueryDto } from './dto/reporte-pos-query.dto';
import { toNumber, round } from './reportes-pos.helpers';

@Injectable()
export class ReportesClientesService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(CuentaCorriente)
    private readonly cuentaCorrienteRepo: Repository<CuentaCorriente>,
    @InjectRepository(MovimientoCuentaCorriente)
    private readonly movimientoCCRepo: Repository<MovimientoCuentaCorriente>,
  ) {}

  async cobrosPendientes(_sucursalId: string, _query: ReportePosQueryDto) {
    const cuentas = await this.cuentaCorrienteRepo
      .createQueryBuilder('cc')
      .innerJoin(Cliente, 'cliente', 'cliente.id = cc.cliente_id')
      .where('cc.saldo > 0')
      .andWhere('cc.activa = true')
      .andWhere('cliente.activo = true')
      .select('cc.id', 'cc_id')
      .addSelect('cc.cliente_id', 'cliente_id')
      .addSelect('cc.saldo', 'saldo')
      .addSelect('cc.limite_credito', 'limite_credito')
      .addSelect(
        `CONCAT(COALESCE(cliente.razon_social, ''), ' ', COALESCE(cliente.nombre, ''), ' ', COALESCE(cliente.apellido, ''))`,
        'cliente_nombre',
      )
      .addSelect('cliente.email', 'email')
      .addSelect('cliente.telefono', 'telefono')
      .orderBy('cc.saldo', 'DESC')
      .getRawMany();

    if (!cuentas.length) return { total_clientes: 0, total_deuda: 0, clientes: [] };

    const ccIds = cuentas.map((c) => c.cc_id);

    const [cargosPendientes, pagos] = await Promise.all([
      this.movimientoCCRepo
        .createQueryBuilder('mov')
        .where('mov.cuenta_corriente_id IN (:...ccIds)', { ccIds })
        .andWhere('mov.tipo = :tipo', { tipo: TipoMovimientoCC.CARGO })
        .select('mov.cuenta_corriente_id', 'cc_id')
        .addSelect('COUNT(mov.id)', 'cantidad_cargos')
        .addSelect('COALESCE(SUM(mov.monto), 0)', 'total_cargos')
        .addSelect('MIN(mov.fecha)', 'cargo_mas_antiguo')
        .addSelect('MAX(mov.fecha_vencimiento)', 'proximo_vencimiento')
        .groupBy('mov.cuenta_corriente_id')
        .getRawMany(),

      this.movimientoCCRepo
        .createQueryBuilder('mov')
        .where('mov.cuenta_corriente_id IN (:...ccIds)', { ccIds })
        .andWhere('mov.tipo IN (:...tipos)', {
          tipos: [TipoMovimientoCC.PAGO, TipoMovimientoCC.NOTA_CREDITO],
        })
        .select('mov.cuenta_corriente_id', 'cc_id')
        .addSelect('COALESCE(SUM(ABS(mov.monto)), 0)', 'total_pagado')
        .addSelect('MAX(mov.fecha)', 'ultimo_pago')
        .groupBy('mov.cuenta_corriente_id')
        .getRawMany(),
    ]);

    const cargosMap = new Map(cargosPendientes.map((r) => [r.cc_id, r]));
    const pagosMap = new Map(pagos.map((r) => [r.cc_id, r]));

    const clientes = cuentas.map((c) => {
      const cargo = cargosMap.get(c.cc_id);
      const pago = pagosMap.get(c.cc_id);
      const saldo = toNumber(c.saldo);
      const limiteCredito = toNumber(c.limite_credito);
      return {
        cliente_id: c.cliente_id,
        cliente: c.cliente_nombre?.trim() || 'Sin nombre',
        email: c.email ?? null,
        telefono: c.telefono ?? null,
        saldo,
        limite_credito: limiteCredito,
        limite_disponible: limiteCredito > 0 ? round(limiteCredito - saldo) : null,
        cantidad_cargos: Number(cargo?.cantidad_cargos ?? 0),
        total_cargos: toNumber(cargo?.total_cargos),
        total_pagado: toNumber(pago?.total_pagado),
        cargo_mas_antiguo: cargo?.cargo_mas_antiguo ?? null,
        ultimo_pago: pago?.ultimo_pago ?? null,
        proximo_vencimiento: cargo?.proximo_vencimiento ?? null,
      };
    });

    return {
      total_clientes: clientes.length,
      total_deuda: round(clientes.reduce((sum, c) => sum + c.saldo, 0)),
      clientes,
    };
  }
}
