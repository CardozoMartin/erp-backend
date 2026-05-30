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
import { UpdateClienteDto } from './dto/update-cliente.dto';

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
  ) {}

  async create(dto: CreateClienteDto): Promise<Cliente> {
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
      return this.findOne(cliente.id);
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

  async update(id: string, dto: UpdateClienteDto): Promise<Cliente> {
    const cliente = await this.findOne(id);

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

    Object.assign(cliente, dto);
    return this.clienteRepo.save(cliente);
  }

  async remove(id: string): Promise<void> {
    const cliente = await this.findOne(id);
    await this.clienteRepo.remove(cliente);
  }

  // Activar cuenta corriente a un cliente que no la tenía
  async activarCuentaCorriente(
    clienteId: string,
    limite: number,
    planPago?: CreatePlanPagoDto,
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
      order: { fecha: 'DESC' },
    });
  }

  // Registrar pago de cuenta corriente
  async registrarPago(
    clienteId: string,
    monto: number,
    descripcion?: string,
    comprobanteId?: string,
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
      });
      await queryRunner.manager.save(movimiento);

      // Actualizar saldo
      const cc = cliente.cuentaCorriente;
      cc.saldo = Number(cc.saldo) - Math.abs(monto);
      await queryRunner.manager.save(cc);

      await queryRunner.commitTransaction();
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
      });
      await queryRunner.manager.save(movimiento);

      // 2. Actualizamos el saldo total de la cuenta corriente.
      const cc = cliente.cuentaCorriente;
      cc.saldo = nuevoSaldo;
      await queryRunner.manager.save(cc);

      await queryRunner.commitTransaction();
      return movimiento;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Omitir un recargo de mora manualmente
  async omitirRecargo(
    movimientoId: string,
    empleadoId: string,
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
      cc.saldo = Number(cc.saldo) - Math.abs(movimiento.monto);
      await queryRunner.manager.save(cc);

      await queryRunner.commitTransaction();
      return movimiento;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
