import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PagosModuleService } from 'src/pagos-module/pagos-module.service';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import {
  AbrirCajaDto,
  CerrarCajaDto,
  RegistrarMovimientoCajaDto,
} from './dto/create-caja.dto';
import { Caja, EstadoCaja } from './entities/caja.entity';
import {
  MovimientoCaja,
  TipoMovimientoCaja,
} from './entities/movimiento-caja.entity';

@Injectable()
export class CajaService {
  constructor(
    @InjectRepository(Caja)
    private readonly cajaRepo: Repository<Caja>,
    @InjectRepository(MovimientoCaja)
    private readonly movimientoRepo: Repository<MovimientoCaja>,
    private readonly pagosService: PagosModuleService,
    private readonly dataSource: DataSource,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async abrir(
    sucursalId: string,
    empleadoId: string,
    dto: AbrirCajaDto,
  ): Promise<Caja> {
    // 1. Validamos que el empleado no tenga otra caja abierta en esta sucursal.
    const cajaAbierta = await this.cajaRepo.findOne({
      where: {
        sucursal_id: sucursalId,
        empleado_id: empleadoId,
        estado: EstadoCaja.ABIERTA,
      },
    });
    if (cajaAbierta) {
      throw new BadRequestException('Ya tenes una caja abierta en esta sucursal');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. Creamos la caja con el monto inicial declarado al abrir el turno.
      const montoInicial = Number(dto.monto_inicial ?? 0);
      const caja = this.cajaRepo.create({
        sucursal_id: sucursalId,
        empleado_id: empleadoId,
        estado: EstadoCaja.ABIERTA,
        monto_inicial: montoInicial,
      });
      await queryRunner.manager.save(caja);

      // 3. Registramos un movimiento de apertura para que la auditoria quede completa.
      await queryRunner.manager.save(
        this.movimientoRepo.create({
          caja_id: caja.id,
          tipo: TipoMovimientoCaja.APERTURA,
          monto: montoInicial,
          empleado_id: empleadoId,
          descripcion: dto.descripcion ?? 'Apertura de caja',
        }),
      );

      await queryRunner.commitTransaction();
      await this.auditoriaService.registrar({
        modulo: 'caja',
        accion: 'ABRIR_CAJA',
        entidad: 'caja',
        entidad_id: caja.id,
        empleado_id: empleadoId,
        sucursal_id: sucursalId,
        descripcion: `Apertura de caja con ${montoInicial}`,
        despues: this.snapshotCaja(await this.findOne(caja.id, sucursalId)),
        metadata: { monto_inicial: montoInicial },
      });
      return this.findOne(caja.id, sucursalId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async registrarMovimientoManual(
    cajaId: string,
    sucursalId: string,
    empleadoId: string,
    dto: RegistrarMovimientoCajaDto,
  ): Promise<MovimientoCaja> {
    // 1. Buscamos la caja y verificamos que siga abierta.
    const caja = await this.findOne(cajaId, sucursalId);
    if (caja.estado !== EstadoCaja.ABIERTA) {
      throw new BadRequestException('No se pueden registrar movimientos en una caja cerrada');
    }

    // 2. Solo permitimos movimientos manuales desde este endpoint.
    if (
      ![
        TipoMovimientoCaja.INGRESO_MANUAL,
        TipoMovimientoCaja.EGRESO,
        TipoMovimientoCaja.AJUSTE,
      ].includes(dto.tipo)
    ) {
      throw new BadRequestException('Tipo de movimiento manual invalido');
    }

    const monto = Number(dto.monto);
    if (dto.tipo === TipoMovimientoCaja.EGRESO && monto > 0) {
      await this.validarSaldoDisponibleParaEgreso(caja.id, monto);
    }

    // 3. Guardamos el movimiento con empleado responsable y descripcion.
    const movimiento = this.movimientoRepo.create({
      caja_id: caja.id,
      tipo: dto.tipo,
      monto,
      empleado_id: empleadoId,
      medio_pago_id: dto.medio_pago_id ?? null,
      categoria_egreso: dto.categoria_egreso ?? null,
      entidad_nombre: dto.entidad_nombre ?? null,
      referencia: dto.referencia ?? null,
      descripcion: dto.descripcion ?? null,
    });
    const guardado = await this.movimientoRepo.save(movimiento);
    await this.auditoriaService.registrar({
      modulo: 'caja',
      accion: dto.tipo === TipoMovimientoCaja.EGRESO ? 'EGRESO_CAJA' : 'MOVIMIENTO_CAJA',
      entidad: 'caja',
      entidad_id: caja.id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: dto.descripcion ?? dto.tipo,
      despues: {
        caja_id: caja.id,
        movimiento_id: guardado.id,
        tipo: dto.tipo,
        monto: Number(dto.monto),
        medio_pago_id: dto.medio_pago_id ?? null,
        categoria_egreso: dto.categoria_egreso ?? null,
        entidad_nombre: dto.entidad_nombre ?? null,
        referencia: dto.referencia ?? null,
      },
      metadata: { movimiento_id: guardado.id },
    });
    return guardado;
  }

  async registrarCobro(params: {
    cajaId: string;
    sucursalId: string;
    empleadoId: string;
    comprobanteId?: string | null;
    medioPagoId?: string | null;
    monto: number;
    referencia?: string | null;
    descripcion?: string | null;
  }): Promise<MovimientoCaja> {
    // 1. Este metodo queda listo para que Pagos POS lo use despues de cobrar.
    const caja = await this.findOne(params.cajaId, params.sucursalId);
    if (caja.estado !== EstadoCaja.ABIERTA) {
      throw new BadRequestException('No se pueden registrar cobros en una caja cerrada');
    }

    // 2. Registramos el cobro ligado al comprobante para auditoria.
    const movimiento = this.movimientoRepo.create({
      caja_id: caja.id,
      tipo: TipoMovimientoCaja.COBRO,
      monto: Number(params.monto),
      empleado_id: params.empleadoId,
      comprobante_id: params.comprobanteId ?? null,
      medio_pago_id: params.medioPagoId ?? null,
      referencia: params.referencia ?? null,
      descripcion: params.descripcion ?? 'Cobro de comprobante',
    });
    const guardado = await this.movimientoRepo.save(movimiento);
    await this.auditoriaService.registrar({
      modulo: 'caja',
      accion: 'COBRO_CAJA',
      entidad: 'caja',
      entidad_id: caja.id,
      empleado_id: params.empleadoId,
      sucursal_id: params.sucursalId,
      descripcion: params.descripcion ?? 'Cobro de comprobante',
      despues: {
        caja_id: params.cajaId,
        movimiento_id: guardado.id,
        comprobante_id: params.comprobanteId ?? null,
        medio_pago_id: params.medioPagoId ?? null,
        monto: Number(params.monto),
        referencia: params.referencia ?? null,
      },
      metadata: {
        movimiento_id: guardado.id,
        caja_id: params.cajaId,
        comprobante_id: params.comprobanteId ?? null,
        medio_pago_id: params.medioPagoId ?? null,
        monto: Number(params.monto),
      },
    });
    return guardado;
  }

  async registrarEgreso(params: {
    cajaId: string;
    sucursalId: string;
    empleadoId: string;
    comprobanteId?: string | null;
    medioPagoId?: string | null;
    monto: number;
    referencia?: string | null;
    descripcion?: string | null;
  }): Promise<MovimientoCaja> {
    // 1. Reembolso de una nota de credito: sale dinero de una caja abierta.
    const caja = await this.findOne(params.cajaId, params.sucursalId);
    if (caja.estado !== EstadoCaja.ABIERTA) {
      throw new BadRequestException('No se pueden registrar egresos en una caja cerrada');
    }

    const monto = Number(params.monto);
    await this.validarSaldoDisponibleParaEgreso(caja.id, monto);

    const movimiento = this.movimientoRepo.create({
      caja_id: caja.id,
      tipo: TipoMovimientoCaja.EGRESO,
      monto,
      empleado_id: params.empleadoId,
      comprobante_id: params.comprobanteId ?? null,
      medio_pago_id: params.medioPagoId ?? null,
      referencia: params.referencia ?? null,
      descripcion: params.descripcion ?? 'Egreso por nota de credito',
    });
    const guardado = await this.movimientoRepo.save(movimiento);
    await this.auditoriaService.registrar({
      modulo: 'caja',
      accion: 'REEMBOLSO_CAJA',
      entidad: 'caja',
      entidad_id: caja.id,
      empleado_id: params.empleadoId,
      sucursal_id: params.sucursalId,
      descripcion: params.descripcion ?? 'Egreso por nota de credito',
      despues: {
        caja_id: params.cajaId,
        movimiento_id: guardado.id,
        comprobante_id: params.comprobanteId ?? null,
        medio_pago_id: params.medioPagoId ?? null,
        monto: Number(params.monto),
        referencia: params.referencia ?? null,
      },
      metadata: {
        movimiento_id: guardado.id,
        caja_id: params.cajaId,
        comprobante_id: params.comprobanteId ?? null,
        monto: Number(params.monto),
      },
    });
    return guardado;
  }

  async cerrar(
    cajaId: string,
    sucursalId: string,
    empleadoId: string,
    dto: CerrarCajaDto,
  ): Promise<Caja> {
    // 1. Validamos que la caja exista, pertenezca a la sucursal activa y este abierta.
    const caja = await this.findOne(cajaId, sucursalId);
    if (caja.estado !== EstadoCaja.ABIERTA) {
      throw new BadRequestException('La caja ya esta cerrada');
    }
    const antes = this.snapshotCaja(caja);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. Calculamos el efectivo/saldo esperado desde los movimientos reales.
      const montoCalculado = await this.calcularMontoEsperado(caja.id);
      const montoDeclarado = Number(dto.monto_final_declarado);

      // 3. Guardamos el cierre con la diferencia declarada vs calculada.
      caja.estado = EstadoCaja.CERRADA;
      caja.monto_final_declarado = montoDeclarado;
      caja.monto_final_calculado = montoCalculado;
      caja.diferencia = Number((montoDeclarado - montoCalculado).toFixed(2));
      caja.fecha_cierre = new Date();
      await queryRunner.manager.save(caja);

      // 4. Registramos el movimiento de cierre para dejar trazabilidad.
      await queryRunner.manager.save(
        this.movimientoRepo.create({
          caja_id: caja.id,
          tipo: TipoMovimientoCaja.CIERRE,
          monto: montoDeclarado,
          empleado_id: empleadoId,
          descripcion: dto.descripcion ?? 'Cierre de caja',
        }),
      );

      await queryRunner.commitTransaction();
      await this.auditoriaService.registrar({
        modulo: 'caja',
        accion: 'CERRAR_CAJA',
        entidad: 'caja',
        entidad_id: caja.id,
        empleado_id: empleadoId,
        sucursal_id: sucursalId,
        descripcion: `Cierre de caja. Declarado ${montoDeclarado}, calculado ${montoCalculado}`,
        antes,
        despues: {
          ...this.snapshotCaja(caja),
          monto_final_declarado: montoDeclarado,
          monto_final_calculado: montoCalculado,
          diferencia: caja.diferencia,
        },
        metadata: {
          monto_final_declarado: montoDeclarado,
          monto_final_calculado: montoCalculado,
          diferencia: caja.diferencia,
          tiene_diferencia: Number(caja.diferencia ?? 0) !== 0,
          descripcion: dto.descripcion ?? null,
        },
      });
      return this.findOne(caja.id, sucursalId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async resumen(cajaId: string, sucursalId: string, empleadoId?: string) {
    const caja = await this.findOne(cajaId, sucursalId, empleadoId);
    const movimientos = caja.movimientos ?? [];
    const mediosPago = await this.pagosService.findAll();
    const mediosById = new Map(mediosPago.map((medio) => [medio.id, medio]));

    const totalesPorTipo = movimientos.reduce<Record<string, number>>(
      (acc, movimiento) => {
        acc[movimiento.tipo] =
          Number(acc[movimiento.tipo] ?? 0) + Number(movimiento.monto ?? 0);
        return acc;
      },
      {},
    );

    const cobrosPorMedioMap = new Map<
      string,
      { medio_pago_id: string | null; medio: string; total: number; cantidad: number }
    >();

    for (const movimiento of movimientos) {
      if (movimiento.tipo !== TipoMovimientoCaja.COBRO) continue;
      const key = movimiento.medio_pago_id ?? 'SIN_MEDIO';
      const current =
        cobrosPorMedioMap.get(key) ??
        {
          medio_pago_id: movimiento.medio_pago_id ?? null,
          medio: movimiento.medio_pago_id
            ? mediosById.get(movimiento.medio_pago_id)?.nombre ?? 'Medio no encontrado'
            : 'Sin medio',
          total: 0,
          cantidad: 0,
        };
      current.total += Number(movimiento.monto ?? 0);
      current.cantidad += 1;
      cobrosPorMedioMap.set(key, current);
    }

    const montoCalculado = await this.calcularMontoEsperado(caja.id);

    return {
      caja,
      totales: {
        apertura: Number(totalesPorTipo[TipoMovimientoCaja.APERTURA] ?? 0),
        cobros: Number(totalesPorTipo[TipoMovimientoCaja.COBRO] ?? 0),
        ingresos_manuales: Number(
          totalesPorTipo[TipoMovimientoCaja.INGRESO_MANUAL] ?? 0,
        ),
        egresos: Number(totalesPorTipo[TipoMovimientoCaja.EGRESO] ?? 0),
        ajustes: Number(totalesPorTipo[TipoMovimientoCaja.AJUSTE] ?? 0),
        calculado: montoCalculado,
        declarado: caja.monto_final_declarado,
        diferencia: caja.diferencia,
      },
      cobros_por_medio: Array.from(cobrosPorMedioMap.values()).map((item) => ({
        ...item,
        total: Number(item.total.toFixed(2)),
      })),
    };
  }

  async calcularMontoEsperado(cajaId: string): Promise<number> {
    // 1. Recorremos los movimientos de caja y aplicamos signo segun tipo.
    const movimientos = await this.movimientoRepo.find({
      where: { caja_id: cajaId },
    });

    const total = movimientos.reduce((sum, movimiento) => {
      const monto = Number(movimiento.monto ?? 0);
      if (movimiento.tipo === TipoMovimientoCaja.CIERRE) return sum;
      if (movimiento.tipo === TipoMovimientoCaja.EGRESO) return sum - monto;
      return sum + monto;
    }, 0);

    return Number(total.toFixed(2));
  }

  private async validarSaldoDisponibleParaEgreso(
    cajaId: string,
    monto: number,
  ): Promise<void> {
    const disponible = await this.calcularMontoEsperado(cajaId);
    if (monto > disponible) {
      throw new BadRequestException(
        `Saldo insuficiente en caja. Disponible: ${disponible.toFixed(2)}, egreso solicitado: ${monto.toFixed(2)}`,
      );
    }
  }

  async findAbiertaPorEmpleado(
    sucursalId: string,
    empleadoId: string,
  ): Promise<Caja | null> {
    return this.cajaRepo.findOne({
      where: {
        sucursal_id: sucursalId,
        empleado_id: empleadoId,
        estado: EstadoCaja.ABIERTA,
      },
      relations: ['movimientos'],
      order: { fecha_apertura: 'DESC' },
    });
  }

  async hayCajaAbiertaEnSucursal(sucursalId: string): Promise<boolean> {
    const cantidad = await this.cajaRepo.count({
      where: {
        sucursal_id: sucursalId,
        estado: EstadoCaja.ABIERTA,
      },
    });
    return cantidad > 0;
  }

  async findAll(
    sucursalId: string,
    options: {
      empleadoId?: string;
      soloAbiertas?: boolean;
      desde?: string;
      hasta?: string;
      estado?: EstadoCaja;
    } = {},
  ): Promise<Caja[]> {
    const qb = this.cajaRepo
      .createQueryBuilder('caja')
      .leftJoinAndSelect('caja.movimientos', 'movimientos')
      .where('caja.sucursal_id = :sucursalId', { sucursalId })
      .orderBy('caja.fecha_apertura', 'DESC')
      .addOrderBy('movimientos.fecha', 'DESC');

    if (options.empleadoId) {
      qb.andWhere('caja.empleado_id = :empleadoId', {
        empleadoId: options.empleadoId,
      });
    }
    if (options.soloAbiertas) {
      qb.andWhere('caja.estado = :estadoAbierta', {
        estadoAbierta: EstadoCaja.ABIERTA,
      });
    } else if (options.estado) {
      qb.andWhere('caja.estado = :estado', { estado: options.estado });
    }
    if (options.desde || options.hasta) {
      const { desde, hasta } = this.rangoFechas(options.desde, options.hasta);
      qb.andWhere('caja.fecha_apertura <= :hasta', { hasta });
      qb.andWhere('(caja.fecha_cierre IS NULL OR caja.fecha_cierre >= :desde)', {
        desde,
      });
    }

    return qb.getMany();
  }

  async findOne(id: string, sucursalId?: string, empleadoId?: string): Promise<Caja> {
    const caja = await this.cajaRepo.findOne({
      where: sucursalId
        ? empleadoId
          ? { id, sucursal_id: sucursalId, empleado_id: empleadoId }
          : { id, sucursal_id: sucursalId }
        : empleadoId
          ? { id, empleado_id: empleadoId }
          : { id },
      relations: ['movimientos'],
    });
    if (!caja) throw new NotFoundException('Caja no encontrada');
    return caja;
  }

  private snapshotCaja(caja: Caja) {
    return {
      id: caja.id,
      estado: caja.estado,
      sucursal_id: caja.sucursal_id,
      empleado_id: caja.empleado_id,
      monto_inicial: Number(caja.monto_inicial ?? 0),
      monto_final_declarado:
        caja.monto_final_declarado == null ? null : Number(caja.monto_final_declarado),
      monto_final_calculado:
        caja.monto_final_calculado == null ? null : Number(caja.monto_final_calculado),
      diferencia: caja.diferencia == null ? null : Number(caja.diferencia),
      fecha_apertura: caja.fecha_apertura,
      fecha_cierre: caja.fecha_cierre,
      movimientos: (caja.movimientos ?? []).map((movimiento) => ({
        id: movimiento.id,
        tipo: movimiento.tipo,
        monto: Number(movimiento.monto ?? 0),
        empleado_id: movimiento.empleado_id,
        comprobante_id: movimiento.comprobante_id,
        medio_pago_id: movimiento.medio_pago_id,
        categoria_egreso: movimiento.categoria_egreso,
        entidad_nombre: movimiento.entidad_nombre,
        referencia: movimiento.referencia,
        descripcion: movimiento.descripcion,
        fecha: movimiento.fecha,
      })),
    };
  }

  private rangoFechas(desde?: string, hasta?: string): { desde: Date; hasta: Date } {
    const inicio = desde ? new Date(desde) : new Date();
    const fin = hasta ? new Date(hasta) : new Date();

    if (!desde || this.esFechaSinHora(desde)) {
      inicio.setHours(0, 0, 0, 0);
    }
    if (!hasta || this.esFechaSinHora(hasta)) {
      fin.setHours(23, 59, 59, 999);
    }

    return { desde: inicio, hasta: fin };
  }

  private esFechaSinHora(value?: string): boolean {
    return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }
}
