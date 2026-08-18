import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CajaService } from 'src/caja/caja.service';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { ClientesService } from 'src/clientes/clientes.service';
import {
  Comprobante,
  EstadoComprobante,
  TipoComprobante,
} from 'src/comprobantes/entities/comprobante.entity';
import { ComprobantesService } from 'src/comprobantes/comprobantes.service';
import { ConfiguracionService } from 'src/configuracion/configuracion.service';
import { DescuentoStock, ModoPOS } from 'src/configuracion/entities/configuracion.entity';
import { PagosModuleService } from 'src/pagos-module/pagos-module.service';
import { StockMovimientosService } from 'src/stock-movimientos/stock-movimientos.service';
import { DataSource, Repository } from 'typeorm';
import { CobrarComprobanteDto, PagoPosItemDto } from './dto/create-pago-pos.dto';
import { PagoPos, TipoPagoPos } from './entities/pago-pos.entity';

@Injectable()
export class PagosPosService {
  constructor(
    @InjectRepository(PagoPos)
    private readonly pagoRepo: Repository<PagoPos>,
    private readonly comprobantesService: ComprobantesService,
    private readonly cajaService: CajaService,
    private readonly pagosService: PagosModuleService,
    private readonly clientesService: ClientesService,
    private readonly configuracionService: ConfiguracionService,
    private readonly stockMovimientosService: StockMovimientosService,
    private readonly dataSource: DataSource,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async cobrar(
    comprobanteId: string,
    sucursalId: string,
    empleadoId: string,
    dto: CobrarComprobanteDto,
  ): Promise<Comprobante> {
    // 1. Buscamos el comprobante dentro de la sucursal activa.
    const comprobante = await this.comprobantesService.findOne(
      comprobanteId,
      sucursalId,
    );
    const antes = this.snapshotComprobanteCobro(comprobante);
    this.validarComprobanteCobrable(comprobante);

    // 2. Validamos configuracion de pago mixto y que la caja pertenezca al empleado.
    const config = await this.configuracionService.crearPorDefecto(sucursalId);
    if (!config.permitir_pago_mixto && dto.pagos.length > 1) {
      throw new BadRequestException('Esta sucursal no permite pago mixto');
    }
    const caja = await this.cajaService.findOne(dto.caja_id, sucursalId);
    // En SIMPLE hay una sola caja para toda la sucursal, asi que varios vendedores
    // cobran sobre la misma: exigir caja propia dejaria operar a uno solo. En los
    // demas modos cada empleado tiene la suya y el dueño si debe coincidir.
    // El pago igual guarda su `empleado_id`, asi que el arqueo distingue quien cobro.
    if (config.modo_pos !== ModoPOS.SIMPLE && caja.empleado_id !== empleadoId) {
      throw new BadRequestException('Solo podés cobrar usando tu propia caja');
    }

    // 3. Validamos y calculamos cada pago antes de escribir nada.
    const pagosCalculados = await Promise.all(
      dto.pagos.map((pago) => this.validarYCalcularPago(pago)),
    );
    const totalPagado = this.round(
      pagosCalculados.reduce(
        (sum, pago) => sum + pago.monto + pago.recargo_monto,
        0,
      ),
    );
    if (totalPagado < Number(comprobante.total)) {
      throw new BadRequestException(
        `El total pagado (${totalPagado}) es menor al total (${comprobante.total})`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 4. Bloqueamos la fila para evitar cobro simultáneo por dos cajeros.
      const bloqueado = await queryRunner.manager
        .getRepository(Comprobante)
        .findOne({ where: { id: comprobante.id }, lock: { mode: 'pessimistic_write' } });
      if (!bloqueado) throw new BadRequestException('Comprobante no encontrado');
      if (
        [EstadoComprobante.COBRADA, EstadoComprobante.ANULADO, EstadoComprobante.CANCELADA, EstadoComprobante.DEVUELTA].includes(bloqueado.estado)
      ) {
        throw new BadRequestException('El comprobante ya fue cobrado o está anulado');
      }

      // 5. Guardamos los pagos POS ligados al comprobante.
      for (const pago of pagosCalculados) {
        const pagoGuardado = this.pagoRepo.create({
          ...pago,
          comprobante_id: comprobante.id,
          caja_id: dto.caja_id,
          empleado_id: empleadoId,
        });
        await queryRunner.manager.save(pagoGuardado);

        // 5. Todo pago que impacta caja genera movimiento de caja auditable.
        if (pago.tipo !== TipoPagoPos.CUENTA_CORRIENTE) {
          await this.cajaService.registrarCobro({
            cajaId: dto.caja_id,
            sucursalId,
            empleadoId,
            comprobanteId: comprobante.id,
            medioPagoId: pago.medio_pago_id,
            monto: pago.monto + pago.recargo_monto,
            referencia: pago.referencia,
            descripcion: `Cobro ${comprobante.numero}`,
          });
        }

        // 6. La cuenta corriente no entra como efectivo: suma deuda al cliente.
        if (pago.tipo === TipoPagoPos.CUENTA_CORRIENTE) {
          if (!comprobante.cliente_id) {
            throw new BadRequestException(
              'Para cobrar por cuenta corriente el comprobante debe tener cliente',
            );
          }
          await this.clientesService.registrarCargo(
            comprobante.cliente_id,
            pago.monto + pago.recargo_monto,
            `Comprobante ${comprobante.numero}`,
            comprobante.id,
            undefined,
            empleadoId,
            sucursalId,
          );
        }
      }

      // 7. Si la sucursal descuenta stock al cobrar, registramos salida auditada.
      if (config.descuento_stock === DescuentoStock.AL_COBRAR) {
        await this.stockMovimientosService.descontarPorComprobante(
          comprobante,
          empleadoId,
          queryRunner.manager,
        );
      }

      // 8. Marcamos el comprobante como cobrado y liberamos el bloqueo de cajero.
      comprobante._estadoAnterior = comprobante.estado;
      comprobante.estado = EstadoComprobante.COBRADA;
      comprobante.caja_id = dto.caja_id;
      comprobante.empleado_cajero_id = empleadoId;
      comprobante.tomada_por_cajero_id = null;
      comprobante.recargo_total = this.round(
        Number(comprobante.recargo_total ?? 0) +
          pagosCalculados.reduce((sum, pago) => sum + pago.recargo_monto, 0),
      );
      comprobante.total = this.round(
        Number(comprobante.subtotal) -
          Number(comprobante.descuento_total) +
          Number(comprobante.recargo_total),
      );
      await queryRunner.manager.save(comprobante);

      await queryRunner.commitTransaction();
      const cobrado = await this.comprobantesService.findOne(comprobante.id, sucursalId);
      await this.auditoriaService.registrar({
        modulo: 'pos',
        accion: 'COBRAR_COMPROBANTE',
        entidad: 'comprobante',
        entidad_id: comprobante.id,
        empleado_id: empleadoId,
        sucursal_id: sucursalId,
        descripcion: `Comprobante cobrado ${comprobante.numero}`,
        antes,
        despues: this.snapshotComprobanteCobro(cobrado),
        metadata: {
          caja_id: dto.caja_id,
          total_pagado: totalPagado,
          total_comprobante: Number(cobrado.total ?? 0),
          pagos: pagosCalculados.map((pago) => ({
            tipo: pago.tipo,
            medio_pago_id: pago.medio_pago_id,
            monto: pago.monto,
            recargo_monto: pago.recargo_monto,
            referencia: pago.referencia,
            cuotas: pago.cuotas,
          })),
          descuento_stock: config.descuento_stock,
        },
      });
      return cobrado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findByComprobante(comprobanteId: string): Promise<PagoPos[]> {
    return this.pagoRepo.find({
      where: { comprobante_id: comprobanteId },
      order: { created_at: 'ASC' },
    });
  }

  async cobrarCuentaCorrienteSinCaja(
    comprobanteId: string,
    sucursalId: string,
    empleadoId: string,
  ): Promise<Comprobante> {
    const comprobante = await this.comprobantesService.findOne(
      comprobanteId,
      sucursalId,
    );
    const antes = this.snapshotComprobanteCobro(comprobante);
    this.validarComprobanteCobrable(comprobante);
    if (!comprobante.cliente_id) {
      throw new BadRequestException(
        'Para cobrar por cuenta corriente el comprobante debe tener cliente',
      );
    }

    const config = await this.configuracionService.crearPorDefecto(sucursalId);
    if (!config.permitir_cuenta_corriente) {
      throw new BadRequestException(
        'La cuenta corriente no esta habilitada para esta sucursal',
      );
    }

    const monto = this.round(Number(comprobante.total ?? 0));
    if (monto <= 0) {
      throw new BadRequestException('El total de la venta debe ser mayor a cero');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const pagoGuardado = this.pagoRepo.create({
        comprobante_id: comprobante.id,
        tipo: TipoPagoPos.CUENTA_CORRIENTE,
        medio_pago_id: null,
        monto,
        cuotas: null,
        recargo_porcentaje: 0,
        recargo_monto: 0,
        referencia: null,
        caja_id: null,
        empleado_id: empleadoId,
      });
      await queryRunner.manager.save(pagoGuardado);

      await this.clientesService.registrarCargo(
        comprobante.cliente_id,
        monto,
        `Comprobante ${comprobante.numero}`,
        comprobante.id,
        undefined,
        empleadoId,
        sucursalId,
      );

      if (config.descuento_stock === DescuentoStock.AL_COBRAR) {
        await this.stockMovimientosService.descontarPorComprobante(
          comprobante,
          empleadoId,
          queryRunner.manager,
        );
      }

      comprobante._estadoAnterior = comprobante.estado;
      comprobante.estado = EstadoComprobante.COBRADA;
      comprobante.caja_id = null;
      comprobante.empleado_cajero_id = empleadoId;
      comprobante.tomada_por_cajero_id = null;
      await queryRunner.manager.save(comprobante);

      await queryRunner.commitTransaction();
      const cobrado = await this.comprobantesService.findOne(comprobante.id, sucursalId);
      await this.auditoriaService.registrar({
        modulo: 'pos',
        accion: 'COBRAR_COMPROBANTE_CUENTA_CORRIENTE',
        entidad: 'comprobante',
        entidad_id: comprobante.id,
        empleado_id: empleadoId,
        sucursal_id: sucursalId,
        descripcion: `Comprobante cobrado por cuenta corriente ${comprobante.numero}`,
        antes,
        despues: this.snapshotComprobanteCobro(cobrado),
        metadata: {
          total_pagado: monto,
          total_comprobante: Number(cobrado.total ?? 0),
          pagos: [
            {
              tipo: TipoPagoPos.CUENTA_CORRIENTE,
              medio_pago_id: null,
              monto,
              recargo_monto: 0,
              referencia: null,
              cuotas: null,
            },
          ],
          descuento_stock: config.descuento_stock,
        },
      });
      return cobrado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private validarComprobanteCobrable(comprobante: Comprobante): void {
    if (
      ![
        TipoComprobante.VENTA,
        TipoComprobante.TICKET,
        TipoComprobante.FACTURA_A,
        TipoComprobante.FACTURA_B,
        TipoComprobante.FACTURA_C,
      ].includes(comprobante.tipo)
    ) {
      throw new BadRequestException('Este tipo de comprobante no se cobra desde POS');
    }

    if (
      [
        EstadoComprobante.COBRADA,
        EstadoComprobante.ANULADO,
        EstadoComprobante.CANCELADA,
        EstadoComprobante.DEVUELTA,
      ].includes(comprobante.estado)
    ) {
      throw new BadRequestException('El comprobante no esta en estado cobrable');
    }
  }

  private async validarYCalcularPago(pago: PagoPosItemDto): Promise<{
    tipo: TipoPagoPos;
    medio_pago_id: string | null;
    monto: number;
    cuotas: number | null;
    recargo_porcentaje: number;
    recargo_monto: number;
    referencia: string | null;
  }> {
    const monto = Number(pago.monto);
    const recargoPorcentaje = Number(pago.recargo_porcentaje ?? 0);
    const recargoMonto = this.round(monto * (recargoPorcentaje / 100));

    if (pago.tipo !== TipoPagoPos.CUENTA_CORRIENTE) {
      if (!pago.medio_pago_id) {
        throw new BadRequestException('El pago requiere medio_pago_id');
      }

      const medioPago = await this.pagosService.findOne(pago.medio_pago_id);
      if (!medioPago.activo) {
        throw new BadRequestException('El medio de pago no esta activo');
      }
      if (medioPago.requiereReferencia && !pago.referencia) {
        throw new BadRequestException(
          `El medio de pago "${medioPago.nombre}" requiere referencia`,
        );
      }
    }

    return {
      tipo: pago.tipo,
      medio_pago_id: pago.medio_pago_id ?? null,
      monto,
      cuotas: pago.cuotas ?? null,
      recargo_porcentaje: recargoPorcentaje,
      recargo_monto: recargoMonto,
      referencia: pago.referencia ?? null,
    };
  }

  private round(value: number): number {
    return Number(Number(value).toFixed(2));
  }

  private snapshotComprobanteCobro(comprobante: Comprobante) {
    return {
      id: comprobante.id,
      tipo: comprobante.tipo,
      estado: comprobante.estado,
      numero: comprobante.numero,
      cliente_id: comprobante.cliente_id,
      caja_id: comprobante.caja_id,
      empleado_vendedor_id: comprobante.empleado_vendedor_id,
      empleado_cajero_id: comprobante.empleado_cajero_id,
      subtotal: Number(comprobante.subtotal ?? 0),
      descuento_total: Number(comprobante.descuento_total ?? 0),
      recargo_total: Number(comprobante.recargo_total ?? 0),
      total: Number(comprobante.total ?? 0),
      items: (comprobante.items ?? []).map((item) => ({
        producto_id: item.producto_id,
        variante_id: item.variante_id,
        descripcion: item.descripcion,
        cantidad: Number(item.cantidad ?? 0),
        precio_unitario: Number(item.precio_unitario ?? 0),
        subtotal: Number(item.subtotal ?? 0),
      })),
    };
  }
}
