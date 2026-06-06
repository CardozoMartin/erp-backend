import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Cliente } from './entities/cliente.entity';
import { CuentaCorriente } from './entities/cuenta-corriente.entity';
import { PlanPago } from './entities/plan-pago.entity';
import {
  MovimientoCuentaCorriente,
  TipoMovimientoCC,
} from './entities/movimiento-cuenta-corriente.entity';
import { CreateClienteDto, CreatePlanPagoDto } from './dto/create-cliente.dto';
import {
  CalcularRecargosCuentaDto,
  RegistrarAjusteCuentaDto,
  RegistrarCargoCuentaDto,
  RegistrarNotaCreditoCuentaDto,
  RegistrarPagoCuentaDto,
} from './dto/cuenta-corriente-operacion.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { AuditoriaService } from 'src/auditoria/auditoria.service';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,

    @InjectRepository(CuentaCorriente)
    private readonly ccRepo: Repository<CuentaCorriente>,

    @InjectRepository(PlanPago)
    private readonly planPagoRepo: Repository<PlanPago>,

    @InjectRepository(MovimientoCuentaCorriente)
    private readonly movimientoRepo: Repository<MovimientoCuentaCorriente>,

    private readonly dataSource: DataSource,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async create(
    dto: CreateClienteDto,
    empleadoId?: string | null,
    sucursalId?: string | null,
  ): Promise<Cliente> {
    // Validar CUIT único si se envía
    if (dto.cuit) {
      const existeCuit = await this.clienteRepo.findOne({
        where: { cuit: dto.cuit },
      });
      if (existeCuit)
        throw new BadRequestException(
          `Ya existe un cliente con el CUIT ${dto.cuit}`,
        );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Crear cliente
      const cliente = this.clienteRepo.create({
        nombre: dto.nombre,
        apellido: dto.apellido ?? null,
        razon_social: dto.razon_social ?? null,
        tipo: dto.tipo,
        cuit: dto.cuit ?? null,
        dni: dto.dni ?? null,
        email: dto.email ?? null,
        telefono: dto.telefono ?? null,
        direccion: dto.direccion ?? null,
        altura: dto.altura ?? null,
        barrio: dto.barrio ?? null,
        localidad: dto.localidad ?? null,
        codigo_postal: dto.codigo_postal ?? null,
        referencia_entrega: dto.referencia_entrega ?? null,
      });
      await queryRunner.manager.save(cliente);

      // Si viene con cuenta corriente, la creamos
      if (dto.cuentaCorriente) {
        const cc = this.ccRepo.create({
          cliente_id: cliente.id,
          limite_credito: dto.cuentaCorriente.limite_credito ?? 0,
          saldo: 0,
          activa: true,
        });
        await queryRunner.manager.save(cc);

        // Si viene con plan de pago, lo creamos
        if (dto.cuentaCorriente.planPago) {
          const plan = this.planPagoRepo.create({
            cuenta_corriente_id: cc.id,
            ...dto.cuentaCorriente.planPago,
          });
          await queryRunner.manager.save(plan);
        }
      }

      await queryRunner.commitTransaction();
      const creado = await this.findOne(cliente.id);
      await this.auditoriaService.registrar({
        modulo: 'clientes',
        accion: 'CREAR_CLIENTE',
        entidad: 'cliente',
        entidad_id: cliente.id,
        empleado_id: empleadoId ?? null,
        sucursal_id: sucursalId ?? null,
        descripcion: `Cliente creado: ${cliente.razon_social || cliente.nombre}`,
        despues: creado as any,
      });
      return creado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<Cliente[]> {
    return this.clienteRepo.find({
      relations: ['cuentaCorriente', 'cuentaCorriente.planPago'],
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Cliente> {
    const cliente = await this.clienteRepo.findOne({
      where: { id },
      relations: ['cuentaCorriente', 'cuentaCorriente.planPago'],
    });
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente;
  }

  async update(
    id: string,
    dto: UpdateClienteDto,
    empleadoId?: string | null,
    sucursalId?: string | null,
  ): Promise<Cliente> {
    const cliente = await this.findOne(id);
    const antes = JSON.parse(JSON.stringify(cliente));

    // Validar CUIT único si se está cambiando
    if (dto.cuit && dto.cuit !== cliente.cuit) {
      const existeCuit = await this.clienteRepo.findOne({
        where: { cuit: dto.cuit },
      });
      if (existeCuit)
        throw new BadRequestException(
          `Ya existe un cliente con el CUIT ${dto.cuit}`,
        );
    }

    const { cuentaCorriente, ...datosCliente } = dto;
    Object.assign(cliente, datosCliente);
    await this.clienteRepo.save(cliente);

    if (cuentaCorriente) {
      const cc =
        cliente.cuentaCorriente ??
        this.ccRepo.create({
          cliente_id: cliente.id,
          saldo: 0,
          activa: true,
        });

      if (cuentaCorriente.limite_credito !== undefined) {
        cc.limite_credito = cuentaCorriente.limite_credito;
      }
      cc.activa = true;
      await this.ccRepo.save(cc);

      if (cuentaCorriente.planPago) {
        const plan =
          cc.planPago ??
          this.planPagoRepo.create({
            cuenta_corriente_id: cc.id,
          });
        Object.assign(plan, cuentaCorriente.planPago);
        await this.planPagoRepo.save(plan);
      }
    }

    const actualizado = await this.findOne(cliente.id);
    await this.auditoriaService.registrar({
      modulo: 'clientes',
      accion: 'ACTUALIZAR_CLIENTE',
      entidad: 'cliente',
      entidad_id: cliente.id,
      empleado_id: empleadoId ?? null,
      sucursal_id: sucursalId ?? null,
      descripcion: `Cliente actualizado: ${actualizado.razon_social || actualizado.nombre}`,
      antes,
      despues: actualizado as any,
    });
    return actualizado;
  }

  async remove(
    id: string,
    empleadoId?: string | null,
    sucursalId?: string | null,
  ): Promise<void> {
    const cliente = await this.findOne(id);
    const antes = JSON.parse(JSON.stringify(cliente));
    await this.clienteRepo.remove(cliente);
    await this.auditoriaService.registrar({
      modulo: 'clientes',
      accion: 'ELIMINAR_CLIENTE',
      entidad: 'cliente',
      entidad_id: id,
      empleado_id: empleadoId ?? null,
      sucursal_id: sucursalId ?? null,
      descripcion: `Cliente eliminado: ${cliente.razon_social || cliente.nombre}`,
      antes,
    });
  }

  // Activar cuenta corriente a un cliente que no la tenía
  async activarCuentaCorriente(
    clienteId: string,
    limite: number,
    planPago?: CreatePlanPagoDto,
    empleadoId?: string | null,
    sucursalId?: string | null,
  ): Promise<CuentaCorriente> {
    const cliente = await this.findOne(clienteId);

    if (cliente.cuentaCorriente)
      throw new BadRequestException('El cliente ya tiene cuenta corriente');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cc = this.ccRepo.create({
        cliente_id: clienteId,
        limite_credito: limite,
        saldo: 0,
        activa: true,
      });
      await queryRunner.manager.save(cc);

      if (planPago) {
        const plan = this.planPagoRepo.create({
          cuenta_corriente_id: cc.id,
          ...planPago,
        });
        await queryRunner.manager.save(plan);
      }

      await queryRunner.commitTransaction();
      await this.auditoriaService.registrar({
        modulo: 'clientes',
        accion: 'ACTIVAR_CUENTA_CORRIENTE',
        entidad: 'cliente',
        entidad_id: clienteId,
        empleado_id: empleadoId ?? null,
        sucursal_id: sucursalId ?? null,
        descripcion: `Cuenta corriente activada para cliente ${clienteId}`,
        despues: { limite_credito: limite, planPago },
      });
      return cc;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Obtener movimientos de la cuenta corriente de un cliente
  async getMovimientos(
    clienteId: string,
  ): Promise<MovimientoCuentaCorriente[]> {
    const cliente = await this.findOne(clienteId);
    if (!cliente.cuentaCorriente)
      throw new BadRequestException('El cliente no tiene cuenta corriente');

    return this.movimientoRepo.find({
      where: { cuenta_corriente_id: cliente.cuentaCorriente.id },
      relations: ['comprobante', 'comprobante.items'],
      order: { fecha: 'DESC' },
    });
  }

  // Registrar pago de cuenta corriente
  async registrarPago(
    clienteId: string,
    monto: number,
    descripcion?: string,
    comprobanteId?: string,
    empleadoId?: string | null,
    sucursalId?: string | null,
  ): Promise<MovimientoCuentaCorriente> {
    const cliente = await this.findOne(clienteId);
    if (!cliente.cuentaCorriente)
      throw new BadRequestException('El cliente no tiene cuenta corriente');
    if (!cliente.cuentaCorriente.activa)
      throw new BadRequestException('La cuenta corriente está inactiva');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // El pago reduce la deuda (monto negativo)
      const movimiento = this.movimientoRepo.create({
        cuenta_corriente_id: cliente.cuentaCorriente.id,
        tipo: TipoMovimientoCC.PAGO,
        monto: -Math.abs(monto),
        descripcion: descripcion ?? 'Pago de cuenta corriente',
        comprobante_id: comprobanteId ?? null,
        movimiento_origen_id: null,
        fecha_vencimiento: null,
        recargo_generado_hasta: null,
      });
      await queryRunner.manager.save(movimiento);

      // Actualizar saldo
      const cc = cliente.cuentaCorriente;
      cc.saldo = Number(cc.saldo) - Math.abs(monto);
      await queryRunner.manager.save(cc);

      await queryRunner.commitTransaction();
      await this.auditoriaService.registrar({
        modulo: 'clientes',
        accion: 'PAGO_CUENTA_CORRIENTE',
        entidad: 'cliente',
        entidad_id: clienteId,
        empleado_id: empleadoId ?? null,
        sucursal_id: sucursalId ?? null,
        descripcion: descripcion ?? 'Pago de cuenta corriente',
        despues: { monto: -Math.abs(monto), comprobante_id: comprobanteId ?? null },
      });
      return movimiento;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async registrarCargo(
    clienteId: string,
    monto: number,
    descripcion?: string,
    comprobanteId?: string,
    fechaVencimiento?: Date,
    empleadoId?: string | null,
    sucursalId?: string | null,
  ): Promise<MovimientoCuentaCorriente> {
    const cliente = await this.findOne(clienteId);
    if (!cliente.cuentaCorriente) {
      throw new BadRequestException('El cliente no tiene cuenta corriente');
    }
    if (!cliente.cuentaCorriente.activa) {
      throw new BadRequestException('La cuenta corriente esta inactiva');
    }

    const saldoActual = Number(cliente.cuentaCorriente.saldo ?? 0);
    const limite = Number(cliente.cuentaCorriente.limite_credito ?? 0);
    const nuevoSaldo = saldoActual + Math.abs(monto);
    if (limite > 0 && nuevoSaldo > limite) {
      throw new BadRequestException('El cargo supera el limite de credito del cliente');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. El cargo suma deuda al cliente.
      const movimiento = this.movimientoRepo.create({
        cuenta_corriente_id: cliente.cuentaCorriente.id,
        tipo: TipoMovimientoCC.CARGO,
        monto: Math.abs(monto),
        descripcion: descripcion ?? 'Cargo de cuenta corriente',
        comprobante_id: comprobanteId ?? null,
        movimiento_origen_id: null,
        fecha_vencimiento:
          fechaVencimiento ??
          this.calcularFechaVencimiento(cliente.cuentaCorriente.planPago),
        recargo_generado_hasta: null,
      });
      await queryRunner.manager.save(movimiento);

      // 2. Actualizamos el saldo total de la cuenta corriente.
      const cc = cliente.cuentaCorriente;
      cc.saldo = nuevoSaldo;
      await queryRunner.manager.save(cc);

      await queryRunner.commitTransaction();
      await this.auditoriaService.registrar({
        modulo: 'clientes',
        accion: 'CARGO_CUENTA_CORRIENTE',
        entidad: 'cliente',
        entidad_id: clienteId,
        empleado_id: empleadoId ?? null,
        sucursal_id: sucursalId ?? null,
        descripcion: descripcion ?? 'Cargo de cuenta corriente',
        despues: {
          monto: Math.abs(monto),
          comprobante_id: comprobanteId ?? null,
          fecha_vencimiento: movimiento.fecha_vencimiento,
        },
      });
      return movimiento;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async registrarCargoManual(
    clienteId: string,
    dto: RegistrarCargoCuentaDto,
    empleadoId?: string | null,
    sucursalId?: string | null,
  ): Promise<MovimientoCuentaCorriente> {
    return this.registrarCargo(
      clienteId,
      dto.monto,
      dto.descripcion,
      dto.comprobante_id,
      dto.fecha_vencimiento ? new Date(dto.fecha_vencimiento) : undefined,
      empleadoId,
      sucursalId,
    );
  }

  async registrarPagoManual(
    clienteId: string,
    dto: RegistrarPagoCuentaDto,
    empleadoId?: string | null,
    sucursalId?: string | null,
  ): Promise<MovimientoCuentaCorriente> {
    return this.registrarPago(
      clienteId,
      dto.monto,
      dto.descripcion,
      dto.comprobante_id,
      empleadoId,
      sucursalId,
    );
  }

  async registrarNotaCredito(
    clienteId: string,
    dto: RegistrarNotaCreditoCuentaDto,
    empleadoId?: string | null,
    sucursalId?: string | null,
  ): Promise<MovimientoCuentaCorriente> {
    const cliente = await this.findOne(clienteId);
    if (!cliente.cuentaCorriente) {
      throw new BadRequestException('El cliente no tiene cuenta corriente');
    }
    if (!cliente.cuentaCorriente.activa) {
      throw new BadRequestException('La cuenta corriente esta inactiva');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. La nota de credito reduce deuda o genera saldo a favor.
      const movimiento = this.movimientoRepo.create({
        cuenta_corriente_id: cliente.cuentaCorriente.id,
        tipo: TipoMovimientoCC.NOTA_CREDITO,
        monto: -Math.abs(dto.monto),
        descripcion: dto.descripcion ?? 'Nota de credito aplicada a cuenta corriente',
        comprobante_id: dto.comprobante_id ?? null,
        movimiento_origen_id: null,
        fecha_vencimiento: null,
        recargo_generado_hasta: null,
      });
      await queryRunner.manager.save(movimiento);

      const cc = cliente.cuentaCorriente;
      const saldoAntes = Number(cc.saldo ?? 0);
      cc.saldo = Number(cc.saldo ?? 0) - Math.abs(dto.monto);
      await queryRunner.manager.save(cc);

      await queryRunner.commitTransaction();
      await this.auditoriaService.registrar({
        modulo: 'clientes',
        accion: 'NOTA_CREDITO_CUENTA_CORRIENTE',
        entidad: 'cliente',
        entidad_id: clienteId,
        empleado_id: empleadoId ?? null,
        sucursal_id: sucursalId ?? null,
        descripcion: dto.descripcion ?? 'Nota de credito aplicada a cuenta corriente',
        antes: { saldo: saldoAntes },
        despues: {
          monto: -Math.abs(dto.monto),
          comprobante_id: dto.comprobante_id ?? null,
          saldo: cc.saldo,
        },
      });
      return movimiento;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async registrarAjuste(
    clienteId: string,
    dto: RegistrarAjusteCuentaDto,
    empleadoId?: string | null,
    sucursalId?: string | null,
  ): Promise<MovimientoCuentaCorriente> {
    const cliente = await this.findOne(clienteId);
    if (!cliente.cuentaCorriente) {
      throw new BadRequestException('El cliente no tiene cuenta corriente');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Ajuste positivo suma deuda; ajuste negativo reduce deuda.
      const monto = Number(dto.monto);
      const movimiento = this.movimientoRepo.create({
        cuenta_corriente_id: cliente.cuentaCorriente.id,
        tipo: TipoMovimientoCC.AJUSTE,
        monto,
        descripcion: dto.descripcion ?? 'Ajuste manual de cuenta corriente',
        comprobante_id: null,
        movimiento_origen_id: null,
        fecha_vencimiento: null,
        recargo_generado_hasta: null,
      });
      await queryRunner.manager.save(movimiento);

      const cc = cliente.cuentaCorriente;
      const saldoAntes = Number(cc.saldo ?? 0);
      cc.saldo = Number(cc.saldo ?? 0) + monto;
      await queryRunner.manager.save(cc);

      await queryRunner.commitTransaction();
      await this.auditoriaService.registrar({
        modulo: 'clientes',
        accion: 'AJUSTE_CUENTA_CORRIENTE',
        entidad: 'cliente',
        entidad_id: clienteId,
        empleado_id: empleadoId ?? null,
        sucursal_id: sucursalId ?? null,
        descripcion: dto.descripcion ?? 'Ajuste manual de cuenta corriente',
        antes: { saldo: saldoAntes },
        despues: {
          movimiento_id: movimiento.id,
          monto,
          saldo: cc.saldo,
        },
        metadata: { accion_sensible: true },
      });
      return movimiento;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async calcularRecargos(
    clienteId: string,
    dto: CalcularRecargosCuentaDto,
    empleadoId?: string | null,
    sucursalId?: string | null,
  ): Promise<{ total: number; movimientos: MovimientoCuentaCorriente[] }> {
    const cliente = await this.findOne(clienteId);
    if (!cliente.cuentaCorriente) {
      throw new BadRequestException('El cliente no tiene cuenta corriente');
    }
    const plan = cliente.cuentaCorriente.planPago;
    if (!plan?.recargo_activo || Number(plan.recargo_porcentaje_diario ?? 0) <= 0) {
      return { total: 0, movimientos: [] };
    }

    const hasta = dto.hasta ? new Date(dto.hasta) : new Date();
    const cargos = await this.movimientoRepo.find({
      where: {
        cuenta_corriente_id: cliente.cuentaCorriente.id,
        tipo: TipoMovimientoCC.CARGO,
        omitido: false,
      },
      order: { fecha: 'ASC' },
    });

    const recargos: MovimientoCuentaCorriente[] = [];
    let total = 0;

    for (const cargo of cargos) {
      if (!cargo.fecha_vencimiento || cargo.fecha_vencimiento >= hasta) continue;

      const desde = cargo.recargo_generado_hasta ?? cargo.fecha_vencimiento;
      if (desde >= hasta) continue;

      const dias = this.diasEntre(desde, hasta);
      if (dias <= 0) continue;

      const monto = this.round(
        Number(cargo.monto) *
          (Number(plan.recargo_porcentaje_diario) / 100) *
          dias,
      );
      if (monto <= 0) continue;

      total = this.round(total + monto);

      const recargo = this.movimientoRepo.create({
        cuenta_corriente_id: cliente.cuentaCorriente.id,
        tipo: TipoMovimientoCC.RECARGO_INTERES,
        monto,
        descripcion: `Recargo por mora de ${dias} dia(s)`,
        comprobante_id: cargo.comprobante_id,
        movimiento_origen_id: cargo.id,
        fecha_vencimiento: null,
        recargo_generado_hasta: hasta,
      });

      if (!dto.solo_simular) {
        const guardado = await this.movimientoRepo.save(recargo);
        cargo.recargo_generado_hasta = hasta;
        await this.movimientoRepo.save(cargo);
        recargos.push(guardado);
      } else {
        recargos.push(recargo);
      }
    }

    if (!dto.solo_simular && total > 0) {
      const cc = cliente.cuentaCorriente;
      const saldoAntes = Number(cc.saldo ?? 0);
      cc.saldo = this.round(Number(cc.saldo ?? 0) + total);
      await this.ccRepo.save(cc);
      await this.auditoriaService.registrar({
        modulo: 'clientes',
        accion: 'GENERAR_RECARGOS_CUENTA_CORRIENTE',
        entidad: 'cliente',
        entidad_id: clienteId,
        empleado_id: empleadoId ?? null,
        sucursal_id: sucursalId ?? null,
        descripcion: `Recargos generados por ${this.round(total)}`,
        antes: { saldo: saldoAntes },
        despues: {
          saldo: cc.saldo,
          total: this.round(total),
          movimientos: recargos.map((movimiento) => ({
            id: movimiento.id,
            monto: movimiento.monto,
            origen_id: movimiento.movimiento_origen_id,
          })),
        },
        metadata: { solo_simular: false },
      });
    }

    return { total, movimientos: recargos };
  }

  // Omitir un recargo de mora manualmente
  async omitirRecargo(
    movimientoId: string,
    empleadoId: string,
    sucursalId?: string | null,
  ): Promise<MovimientoCuentaCorriente> {
    const movimiento = await this.movimientoRepo.findOne({
      where: { id: movimientoId },
      relations: ['cuentaCorriente'],
    });
    if (!movimiento) throw new NotFoundException('Movimiento no encontrado');
    if (movimiento.tipo !== TipoMovimientoCC.RECARGO_INTERES)
      throw new BadRequestException(
        'Solo se pueden omitir recargos de interés',
      );
    if (movimiento.omitido)
      throw new BadRequestException('Este recargo ya fue omitido');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Marcar el movimiento como omitido
      movimiento.omitido = true;
      movimiento.omitido_por = empleadoId;
      await queryRunner.manager.save(movimiento);

      // Revertir el monto del saldo
      const cc = movimiento.cuentaCorriente;
      const saldoAntes = Number(cc.saldo);
      cc.saldo = Number(cc.saldo) - Math.abs(movimiento.monto);
      await queryRunner.manager.save(cc);

      await queryRunner.commitTransaction();
      await this.auditoriaService.registrar({
        modulo: 'clientes',
        accion: 'OMITIR_RECARGO_CUENTA_CORRIENTE',
        entidad: 'cliente',
        entidad_id: movimiento.cuentaCorriente.cliente_id,
        empleado_id: empleadoId ?? null,
        sucursal_id: sucursalId ?? null,
        descripcion: `Recargo omitido: ${movimientoId}`,
        antes: { movimiento_id: movimientoId, omitido: false, saldo: saldoAntes },
        despues: {
          movimiento_id: movimientoId,
          omitido: true,
          omitido_por: empleadoId,
          saldo: cc.saldo,
        },
        metadata: { accion_sensible: true },
      });
      return movimiento;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private calcularFechaVencimiento(plan?: PlanPago | null): Date | null {
    if (!plan) return null;

    const fecha = new Date();
    if (plan.tipo_vencimiento === 'DIA_FIJO') {
      const dia = Math.min(Number(plan.valor_vencimiento), 28);
      fecha.setDate(dia);
      if (fecha < new Date()) fecha.setMonth(fecha.getMonth() + 1);
      return fecha;
    }

    fecha.setDate(fecha.getDate() + Number(plan.valor_vencimiento));
    return fecha;
  }

  private diasEntre(desde: Date, hasta: Date): number {
    const msPorDia = 1000 * 60 * 60 * 24;
    return Math.floor((hasta.getTime() - desde.getTime()) / msPorDia);
  }

  private round(value: number): number {
    return Number(Number(value).toFixed(2));
  }
}
