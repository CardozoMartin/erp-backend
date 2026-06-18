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
import { CajaService } from 'src/caja/caja.service';
import { ConfiguracionEmailService } from 'src/configuracion/configuracion-email.service';
import {
  EnviarResumenCuentaDto,
  TipoResumenCuenta,
} from './dto/enviar-resumen-cuenta.dto';

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
    private readonly cajaService: CajaService,
    private readonly configuracionEmailService: ConfiguracionEmailService,
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

  async findAll(activo?: boolean): Promise<Cliente[]> {
    return this.clienteRepo.find({
      where: activo !== undefined ? { activo } : {},
      relations: ['cuentaCorriente', 'cuentaCorriente.planPago'],
      order: { nombre: 'ASC' },
    });
  }

  async toggleActivo(
    id: string,
    empleadoId?: string | null,
    sucursalId?: string | null,
  ): Promise<Cliente> {
    const cliente = await this.findOne(id);
    const antes = JSON.parse(JSON.stringify(cliente));
    cliente.activo = !cliente.activo;
    await this.clienteRepo.save(cliente);
    await this.auditoriaService.registrar({
      modulo: 'clientes',
      accion: cliente.activo ? 'ACTIVAR_CLIENTE' : 'DESACTIVAR_CLIENTE',
      entidad: 'cliente',
      entidad_id: id,
      empleado_id: empleadoId ?? null,
      sucursal_id: sucursalId ?? null,
      descripcion: `Cliente ${cliente.activo ? 'activado' : 'desactivado'}: ${cliente.razon_social || cliente.nombre}`,
      antes,
      despues: cliente as any,
    });
    return this.findOne(id);
  }

  async toggleCuentaCorriente(
    id: string,
    empleadoId?: string | null,
    sucursalId?: string | null,
  ): Promise<CuentaCorriente> {
    const cliente = await this.findOne(id);
    if (!cliente.cuentaCorriente)
      throw new BadRequestException('El cliente no tiene cuenta corriente');
    const cc = cliente.cuentaCorriente;
    cc.activa = !cc.activa;
    await this.ccRepo.save(cc);
    await this.auditoriaService.registrar({
      modulo: 'clientes',
      accion: cc.activa ? 'ACTIVAR_CUENTA_CORRIENTE' : 'SUSPENDER_CUENTA_CORRIENTE',
      entidad: 'cliente',
      entidad_id: id,
      empleado_id: empleadoId ?? null,
      sucursal_id: sucursalId ?? null,
      descripcion: `Cuenta corriente ${cc.activa ? 'activada' : 'suspendida'} para: ${cliente.razon_social || cliente.nombre}`,
    });
    return cc;
  }

  async setBloqueo(
    id: string,
    bloqueado: boolean,
    razon: string | null,
    empleadoId?: string | null,
    sucursalId?: string | null,
  ): Promise<Cliente> {
    const cliente = await this.findOne(id);
    const antes = JSON.parse(JSON.stringify(cliente));
    cliente.bloqueado = bloqueado;
    cliente.razon_bloqueo = bloqueado ? (razon ?? null) : null;
    await this.clienteRepo.save(cliente);
    await this.auditoriaService.registrar({
      modulo: 'clientes',
      accion: bloqueado ? 'BLOQUEAR_CREDITO_CLIENTE' : 'DESBLOQUEAR_CREDITO_CLIENTE',
      entidad: 'cliente',
      entidad_id: id,
      empleado_id: empleadoId ?? null,
      sucursal_id: sucursalId ?? null,
      descripcion: bloqueado
        ? `Crédito bloqueado (${razon ?? 'sin razón'}): ${cliente.razon_social || cliente.nombre}`
        : `Crédito desbloqueado: ${cliente.razon_social || cliente.nombre}`,
      antes,
      despues: cliente as any,
    });
    return this.findOne(id);
  }

  async setAccionLegal(
    id: string,
    accion_legal: boolean,
    empleadoId?: string | null,
    sucursalId?: string | null,
  ): Promise<Cliente> {
    const cliente = await this.findOne(id);
    const antes = JSON.parse(JSON.stringify(cliente));
    cliente.accion_legal = accion_legal;
    await this.clienteRepo.save(cliente);
    await this.auditoriaService.registrar({
      modulo: 'clientes',
      accion: accion_legal ? 'MARCAR_ACCION_LEGAL' : 'QUITAR_ACCION_LEGAL',
      entidad: 'cliente',
      entidad_id: id,
      empleado_id: empleadoId ?? null,
      sucursal_id: sucursalId ?? null,
      descripcion: `Acción legal ${accion_legal ? 'marcada' : 'removida'}: ${cliente.razon_social || cliente.nombre}`,
      antes,
      despues: cliente as any,
    });
    return this.findOne(id);
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
    if (!cliente.activo)
      throw new BadRequestException('El cliente está inactivo y no puede operar');
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
    if (!cliente.activo)
      throw new BadRequestException('El cliente está inactivo y no puede operar');
    if (cliente.bloqueado)
      throw new BadRequestException(`Crédito bloqueado: ${cliente.razon_bloqueo ?? 'contactar administración'}`);
    if (cliente.accion_legal)
      throw new BadRequestException('El cliente tiene una acción legal activa y no puede operar a crédito');
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
    if (!sucursalId) {
      throw new BadRequestException('Seleccione una sucursal para registrar el pago');
    }
    if (!empleadoId) {
      throw new BadRequestException('No se pudo identificar el empleado del pago');
    }

    const movimiento = await this.registrarPago(
      clienteId,
      dto.monto,
      dto.descripcion,
      dto.comprobante_id,
      empleadoId,
      sucursalId,
    );
    await this.cajaService.registrarCobro({
      cajaId: dto.caja_id,
      sucursalId,
      empleadoId,
      comprobanteId: dto.comprobante_id ?? null,
      medioPagoId: dto.medio_pago_id ?? null,
      monto: dto.monto,
      referencia: dto.referencia ?? null,
      descripcion: dto.descripcion ?? 'Pago de cuenta corriente',
    });
    return movimiento;
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

  async enviarResumenCuentaCorriente(
    clienteId: string,
    dto: EnviarResumenCuentaDto,
    empleadoId?: string | null,
    sucursalId?: string | null,
  ) {
    if (!sucursalId) {
      throw new BadRequestException('Seleccione una sucursal para enviar emails');
    }
    const cliente = await this.findOne(clienteId);
    if (!cliente.cuentaCorriente) {
      throw new BadRequestException('El cliente no tiene cuenta corriente');
    }
    const movimientos = this.filtrarMovimientosResumen(
      await this.getMovimientos(clienteId),
      dto,
    );
    const destino = dto.destino.trim().toLowerCase();
    const nombre = this.nombreCliente(cliente);
    const saldo = Number(cliente.cuentaCorriente.saldo ?? 0);
    const asunto =
      dto.asunto?.trim() || `Resumen de cuenta corriente - ${nombre}`;
    const tipoResumen = dto.tipo_resumen ?? TipoResumenCuenta.CARGOS;
    const adjuntarPdf = dto.adjuntar_pdf !== false;

    await this.configuracionEmailService.enviarCorreoSucursal(sucursalId, {
      to: destino,
      subject: asunto,
      text: this.buildResumenCuentaText(cliente, movimientos, dto),
      attachments: adjuntarPdf
        ? [
            {
              filename: this.nombreArchivoResumenCuenta(cliente, dto),
              contentType: 'application/pdf',
              content: this.buildResumenCuentaPdf(cliente, movimientos, dto),
            },
          ]
        : undefined,
    });

    await this.auditoriaService.registrar({
      modulo: 'clientes',
      accion: 'ENVIAR_RESUMEN_CUENTA_CORRIENTE_EMAIL',
      entidad: 'cliente',
      entidad_id: clienteId,
      empleado_id: empleadoId ?? null,
      sucursal_id: sucursalId,
      descripcion: `Resumen de cuenta corriente enviado a ${destino}`,
      metadata: {
        destino,
        saldo,
        desde: dto.desde ?? null,
        hasta: dto.hasta ?? null,
        tipo_resumen: tipoResumen,
        adjuntar_pdf: adjuntarPdf,
        movimientos: movimientos.length,
      },
    });

    return { ok: true, message: `Resumen de cuenta corriente enviado a ${destino}` };
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

  private buildResumenCuentaText(
    cliente: Cliente,
    movimientos: MovimientoCuentaCorriente[],
    dto: EnviarResumenCuentaDto,
  ) {
    const cc = cliente.cuentaCorriente!;
    const saldo = Number(cc.saldo ?? 0);
    const totalCargos = movimientos
      .filter((movimiento) => Number(movimiento.monto) > 0 && !movimiento.omitido)
      .reduce((sum, movimiento) => sum + Number(movimiento.monto), 0);
    const totalCreditos = movimientos
      .filter((movimiento) => Number(movimiento.monto) < 0 && !movimiento.omitido)
      .reduce((sum, movimiento) => sum + Math.abs(Number(movimiento.monto)), 0);
    const ultimosMovimientos = movimientos.slice(0, 25).map((movimiento) => {
      const comprobante = movimiento.comprobante?.numero
        ? ` | Comprobante ${movimiento.comprobante.numero}`
        : '';
      const vencimiento = movimiento.fecha_vencimiento
        ? ` | Vence ${this.formatDate(movimiento.fecha_vencimiento)}`
        : '';
      const omitido = movimiento.omitido ? ' | Omitido' : '';
      return [
        `- ${this.formatDate(movimiento.fecha)} | ${movimiento.tipo}`,
        `${this.formatCurrency(Number(movimiento.monto ?? 0))}`,
        movimiento.descripcion ? `| ${movimiento.descripcion}` : '',
        comprobante,
        vencimiento,
        omitido,
      ]
        .filter(Boolean)
        .join(' ');
    });

    return [
      dto.mensaje?.trim() || 'Te enviamos el resumen actualizado de tu cuenta corriente.',
      '',
      `Cliente: ${this.nombreCliente(cliente)}`,
      `Documento: ${cliente.cuit || cliente.dni || '-'}`,
      `Fecha de envio: ${this.formatDate(new Date())}`,
      `Periodo: ${this.describePeriodoResumen(dto)}`,
      `Detalle incluido: ${this.labelTipoResumen(dto.tipo_resumen ?? TipoResumenCuenta.CARGOS)}`,
      '',
      `Saldo actual: ${this.formatCurrency(saldo)}`,
      `Limite de credito: ${
        Number(cc.limite_credito ?? 0) > 0
          ? this.formatCurrency(Number(cc.limite_credito))
          : 'Sin limite'
      }`,
      `Total cargos: ${this.formatCurrency(totalCargos)}`,
      `Total pagos/creditos: ${this.formatCurrency(totalCreditos)}`,
      '',
      'Ultimos movimientos:',
      ultimosMovimientos.length ? ultimosMovimientos.join('\n') : 'Sin movimientos registrados.',
      '',
      saldo > 0
        ? `Total adeudado: ${this.formatCurrency(saldo)}`
        : `Saldo a favor o sin deuda: ${this.formatCurrency(Math.abs(saldo))}`,
    ].join('\n');
  }

  private filtrarMovimientosResumen(
    movimientos: MovimientoCuentaCorriente[],
    dto: EnviarResumenCuentaDto,
  ) {
    const desde = dto.desde ? new Date(`${dto.desde}T00:00:00`) : null;
    const hasta = dto.hasta ? new Date(`${dto.hasta}T23:59:59.999`) : null;
    const tipoResumen = dto.tipo_resumen ?? TipoResumenCuenta.CARGOS;

    if (desde && Number.isNaN(desde.getTime())) {
      throw new BadRequestException('La fecha desde no es valida');
    }
    if (hasta && Number.isNaN(hasta.getTime())) {
      throw new BadRequestException('La fecha hasta no es valida');
    }
    if (desde && hasta && desde > hasta) {
      throw new BadRequestException('La fecha desde no puede ser posterior a hasta');
    }

    return movimientos.filter((movimiento) => {
      const fecha = new Date(movimiento.fecha);
      if (desde && fecha < desde) return false;
      if (hasta && fecha > hasta) return false;
      if (tipoResumen === TipoResumenCuenta.TODOS) return true;
      if (tipoResumen === TipoResumenCuenta.CARGOS_Y_RECARGOS) {
        return [TipoMovimientoCC.CARGO, TipoMovimientoCC.RECARGO_INTERES].includes(
          movimiento.tipo,
        );
      }
      if (tipoResumen === TipoResumenCuenta.COMPRAS) {
        return movimiento.tipo === TipoMovimientoCC.CARGO && !!movimiento.comprobante_id;
      }
      return movimiento.tipo === TipoMovimientoCC.CARGO;
    });
  }

  private buildResumenCuentaPdf(
    cliente: Cliente,
    movimientos: MovimientoCuentaCorriente[],
    dto: EnviarResumenCuentaDto,
  ) {
    const cc = cliente.cuentaCorriente!;
    const lines = [
      'Resumen de cuenta corriente',
      '',
      `Cliente: ${this.nombreCliente(cliente)}`,
      `Documento: ${cliente.cuit || cliente.dni || '-'}`,
      `Fecha de envio: ${this.formatDate(new Date())}`,
      `Periodo: ${this.describePeriodoResumen(dto)}`,
      `Detalle incluido: ${this.labelTipoResumen(dto.tipo_resumen ?? TipoResumenCuenta.CARGOS)}`,
      `Saldo actual: ${this.formatCurrency(Number(cc.saldo ?? 0))}`,
      '',
      ...this.resumenMovimientosPdfLines(movimientos),
    ];
    return this.createSimplePdf(lines);
  }

  private resumenMovimientosPdfLines(movimientos: MovimientoCuentaCorriente[]) {
    if (!movimientos.length) return ['Sin movimientos para el filtro seleccionado.'];

    const lines = [
      'Detalle de compras/cargos',
      this.pdfTableSeparator(),
      `${this.padPdfCell('Fecha', 16)} ${this.padPdfCell('Producto', 42)} ${this.padPdfCell('Precio', 14, 'right')} ${this.padPdfCell('Acumulado', 14, 'right')}`,
      this.pdfTableSeparator(),
    ];
    let acumulado = 0;
    const ordenados = [...movimientos].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
    );

    for (const movimiento of ordenados) {
      const items = movimiento.comprobante?.items ?? [];
      if (!items.length) {
        const monto = Number(movimiento.monto ?? 0);
        acumulado += monto;
        lines.push(
          `${this.padPdfCell(this.formatDateShort(movimiento.fecha), 16)} ${this.padPdfCell(movimiento.descripcion || movimiento.tipo, 42)} ${this.padPdfCell(this.formatCurrencyCompact(monto), 14, 'right')} ${this.padPdfCell(this.formatCurrencyCompact(acumulado), 14, 'right')}`,
        );
        continue;
      }

      for (const item of items) {
        const monto = Number(item.subtotal ?? 0);
        acumulado += monto;
        const producto = `${Number(item.cantidad ?? 0)} x ${item.descripcion}`;
        lines.push(
          `${this.padPdfCell(this.formatDateShort(movimiento.fecha), 16)} ${this.padPdfCell(producto, 42)} ${this.padPdfCell(this.formatCurrencyCompact(monto), 14, 'right')} ${this.padPdfCell(this.formatCurrencyCompact(acumulado), 14, 'right')}`,
        );
      }
    }

    lines.push(this.pdfTableSeparator());
    lines.push(
      `${this.padPdfCell('Total del periodo', 59)} ${this.padPdfCell(this.formatCurrencyCompact(acumulado), 29, 'right')}`,
    );
    return lines;
  }

  private pdfTableSeparator() {
    return '-'.repeat(91);
  }

  private padPdfCell(value: string, length: number, align: 'left' | 'right' = 'left') {
    const text = this.toPdfSafeText(value);
    const trimmed = text.length > length ? `${text.slice(0, Math.max(0, length - 1))}.` : text;
    return align === 'right' ? trimmed.padStart(length, ' ') : trimmed.padEnd(length, ' ');
  }

  private formatCurrencyCompact(value: number) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private formatDateShort(value: Date) {
    return new Date(value).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private createSimplePdf(lines: string[]) {
    const sanitizedLines = lines.flatMap((line) => this.wrapPdfLine(line, 96));
    const pageSize = 48;
    const pages: string[][] = [];
    for (let index = 0; index < sanitizedLines.length; index += pageSize) {
      pages.push(sanitizedLines.slice(index, index + pageSize));
    }
    if (!pages.length) pages.push(['Sin datos']);

    const objects: string[] = [];
    const catalogId = 1;
    const pagesId = 2;
    const fontId = 3;
    const pageIds = pages.map((_, index) => 4 + index * 2);
    const contentIds = pages.map((_, index) => 5 + index * 2);

    objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
    objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>';

    pages.forEach((pageLines, index) => {
      const content = [
        'BT',
        '/F1 10 Tf',
        '40 790 Td',
        '14 TL',
        ...pageLines.map((line) => `(${this.escapePdfText(line)}) Tj T*`),
        'ET',
      ].join('\n');
      const contentId = contentIds[index];
      objects[contentId] = `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`;
      objects[pageIds[index]] =
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    });

    const ordered = objects
      .map((object, index) => ({ object, index }))
      .filter((item) => item.object);
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (const item of ordered) {
      offsets[item.index] = Buffer.byteLength(pdf, 'latin1');
      pdf += `${item.index} 0 obj\n${item.object}\nendobj\n`;
    }
    const xrefOffset = Buffer.byteLength(pdf, 'latin1');
    const maxId = Math.max(...ordered.map((item) => item.index));
    pdf += `xref\n0 ${maxId + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let index = 1; index <= maxId; index += 1) {
      pdf += `${String(offsets[index] ?? 0).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${maxId + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, 'latin1');
  }

  private wrapPdfLine(line: string, maxLength: number) {
    const normalized = this.toPdfSafeText(line);
    if (normalized.length <= maxLength) return [normalized];
    const chunks: string[] = [];
    for (let index = 0; index < normalized.length; index += maxLength) {
      chunks.push(normalized.slice(index, index + maxLength));
    }
    return chunks;
  }

  private escapePdfText(value: string) {
    return this.toPdfSafeText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  private toPdfSafeText(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, ' ');
  }

  private nombreArchivoResumenCuenta(cliente: Cliente, dto: EnviarResumenCuentaDto) {
    const nombre = this.nombreCliente(cliente)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    const desde = dto.desde || 'inicio';
    const hasta = dto.hasta || 'hoy';
    return `resumen-cuenta-${nombre || 'cliente'}-${desde}-${hasta}.pdf`;
  }

  private describePeriodoResumen(dto: EnviarResumenCuentaDto) {
    if (dto.desde && dto.hasta) return `${dto.desde} a ${dto.hasta}`;
    if (dto.desde) return `Desde ${dto.desde}`;
    if (dto.hasta) return `Hasta ${dto.hasta}`;
    return 'Todos los movimientos disponibles';
  }

  private labelTipoResumen(tipo: TipoResumenCuenta) {
    const labels: Record<TipoResumenCuenta, string> = {
      [TipoResumenCuenta.CARGOS]: 'Compras y cargos',
      [TipoResumenCuenta.COMPRAS]: 'Compras con comprobante',
      [TipoResumenCuenta.CARGOS_Y_RECARGOS]: 'Compras, cargos y recargos',
      [TipoResumenCuenta.TODOS]: 'Todos los movimientos',
    };
    return labels[tipo];
  }

  private nombreCliente(cliente: Cliente) {
    return (
      cliente.razon_social ||
      [cliente.nombre, cliente.apellido].filter(Boolean).join(' ') ||
      'Cliente'
    );
  }

  private formatCurrency(value: number) {
    return value.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 2,
    });
  }

  private formatDate(value: Date) {
    return new Date(value).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
