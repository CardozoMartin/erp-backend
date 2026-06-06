import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import {
  Comprobante,
  EstadoComprobante,
  TipoComprobante,
} from 'src/comprobantes/entities/comprobante.entity';
import { ComprobantesService } from 'src/comprobantes/comprobantes.service';
import { CreateComprobanteDto } from 'src/comprobantes/dto/create-comprobante.dto';
import { DescuentoStock } from 'src/configuracion/entities/configuracion.entity';
import { ConfiguracionService } from 'src/configuracion/configuracion.service';
import { StockMovimientosService } from 'src/stock-movimientos/stock-movimientos.service';
import { DataSource, Repository } from 'typeorm';
import {
  AnularDespachoDto,
  CrearDespachoDto,
  EntregarDespachoDto,
} from './dto/create-despacho.dto';
import { DespachoItem } from './entities/despacho-item.entity';
import { Despacho, EstadoDespacho } from './entities/despacho.entity';

@Injectable()
export class DespachosService {
  constructor(
    @InjectRepository(Despacho)
    private readonly despachoRepo: Repository<Despacho>,
    @InjectRepository(DespachoItem)
    private readonly itemRepo: Repository<DespachoItem>,
    private readonly comprobantesService: ComprobantesService,
    private readonly configuracionService: ConfiguracionService,
    private readonly stockMovimientosService: StockMovimientosService,
    private readonly dataSource: DataSource,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async crearDesdeComprobante(
    sucursalId: string,
    empleadoId: string,
    dto: CrearDespachoDto,
  ): Promise<Despacho> {
    // 1. Validamos que el comprobante pueda entrar al flujo de despacho.
    const comprobante = await this.comprobantesService.findOne(
      dto.comprobante_id,
      sucursalId,
    );
    this.validarComprobanteDespachable(comprobante);

    const existe = await this.despachoRepo.findOne({
      where: { comprobante_id: comprobante.id, sucursal_id: sucursalId },
    });
    if (existe) {
      throw new BadRequestException('Este comprobante ya tiene un despacho creado');
    }

    if (!comprobante.items?.some((item) => item.producto_id)) {
      throw new BadRequestException('El comprobante no tiene productos para despachar');
    }

    // 2. Creamos la cabecera y copiamos las lineas del comprobante.
    const despacho = this.despachoRepo.create({
      estado: EstadoDespacho.PENDIENTE,
      comprobante_id: comprobante.id,
      sucursal_id: sucursalId,
      empleado_despachador_id: empleadoId,
      observaciones: dto.observaciones ?? null,
    });
    const despachoGuardado = await this.despachoRepo.save(despacho);

    const items = comprobante.items
      .filter((item) => item.producto_id)
      .map((item) =>
        this.itemRepo.create({
          despacho_id: despachoGuardado.id,
          comprobante_item_id: item.id,
          producto_id: item.producto_id,
          variante_id: item.variante_id ?? null,
          descripcion: item.descripcion,
          cantidad_solicitada: Number(item.cantidad),
          cantidad_despachada: 0,
          cantidad_pendiente: Number(item.cantidad),
          motivo_pendiente: null,
        }),
    );
    await this.itemRepo.save(items);

    const creado = await this.findOne(despachoGuardado.id, sucursalId);
    await this.auditoriaService.registrar({
      modulo: 'despachos',
      accion: 'CREAR_DESPACHO',
      entidad: 'despacho',
      entidad_id: creado.id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: `Despacho creado para ${comprobante.numero}`,
      despues: {
        comprobante_id: comprobante.id,
        comprobante_numero: comprobante.numero,
        items: items.length,
      },
    });
    return creado;
  }

  async crearAutomaticoSiNoExiste(
    sucursalId: string,
    empleadoId: string,
    comprobanteId: string,
  ): Promise<Despacho> {
    const existente = await this.despachoRepo.findOne({
      where: { comprobante_id: comprobanteId, sucursal_id: sucursalId },
    });
    if (existente) return this.findOne(existente.id, sucursalId);

    return this.crearDesdeComprobante(sucursalId, empleadoId, {
      comprobante_id: comprobanteId,
      observaciones: 'Despacho generado automaticamente al cobrar venta',
    });
  }

  async entregar(
    id: string,
    sucursalId: string,
    empleadoId: string,
    dto: EntregarDespachoDto,
  ): Promise<Despacho> {
    const despacho = await this.findOne(id, sucursalId);
    const estadoAntes = despacho.estado;
    if (despacho.estado === EstadoDespacho.ANULADO) {
      throw new BadRequestException('No se puede entregar un despacho anulado');
    }
    if (despacho.estado === EstadoDespacho.ENTREGADO) {
      throw new BadRequestException('El despacho ya fue entregado completo');
    }
    if (!dto.items?.length) {
      throw new BadRequestException('Debe informar al menos un item a entregar');
    }

    const config = await this.configuracionService.crearPorDefecto(sucursalId);
    const entregas = this.normalizarEntregas(dto, despacho);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let transaccionConfirmada = false;

    try {
      // 1. Aplicamos cantidades entregadas y, si corresponde, descontamos stock.
      const itemsParaRemito: DespachoItem[] = [];
      for (const entrega of entregas) {
        const item = entrega.item;
        const cantidadEntrega = entrega.cantidad;
        const pendienteActual = Number(item.cantidad_pendiente ?? 0);

        if (cantidadEntrega > pendienteActual) {
          throw new BadRequestException(
            `No se puede despachar mas de lo pendiente para "${item.descripcion}"`,
          );
        }

        if (config.descuento_stock === DescuentoStock.AL_DESPACHAR) {
          await this.stockMovimientosService.registrarSalidaPorDespacho(
            sucursalId,
            empleadoId,
            {
              despacho_id: despacho.id,
              comprobante_id: despacho.comprobante_id,
              item: item.comprobanteItem,
              cantidad: cantidadEntrega,
            },
            queryRunner.manager,
          );
        }

        item.cantidad_despachada =
          Number(item.cantidad_despachada ?? 0) + cantidadEntrega;
        item.cantidad_pendiente = pendienteActual - cantidadEntrega;
        item.motivo_pendiente =
          item.cantidad_pendiente > 0 ? entrega.motivo_pendiente ?? null : null;
        await queryRunner.manager.save(item);

        if (cantidadEntrega > 0) itemsParaRemito.push({ ...item, cantidad_pendiente: 0 });
      }

      // 2. Recalculamos el estado general segun pendientes reales.
      const itemsActualizados = await queryRunner.manager.find(DespachoItem, {
        where: { despacho_id: despacho.id },
      });
      const totalPendiente = itemsActualizados.reduce(
        (sum, item) => sum + Number(item.cantidad_pendiente ?? 0),
        0,
      );
      const totalDespachado = itemsActualizados.reduce(
        (sum, item) => sum + Number(item.cantidad_despachada ?? 0),
        0,
      );

      despacho.estado =
        totalPendiente === 0
          ? EstadoDespacho.ENTREGADO
          : totalDespachado > 0
            ? EstadoDespacho.ENTREGADO_PARCIAL
            : EstadoDespacho.PENDIENTE;
      despacho.empleado_despachador_id = empleadoId;
      despacho.fecha_despacho = totalDespachado > 0 ? new Date() : despacho.fecha_despacho;
      despacho.observaciones = dto.observaciones ?? despacho.observaciones;
      await queryRunner.manager.save(despacho);

      await queryRunner.commitTransaction();
      transaccionConfirmada = true;

      // 3. El remito se numera como comprobante separado. Lo generamos despues de confirmar la entrega.
      if (dto.generar_remito && itemsParaRemito.length) {
        const remito = await this.generarRemito(
          sucursalId,
          empleadoId,
          despacho,
          entregas,
        );
        despacho.remito_id = remito.id;
        await this.despachoRepo.save(despacho);
      }

      // 4. Reflejamos el estado de entrega en el comprobante original.
      await this.comprobantesService.cambiarEstado(despacho.comprobante_id, sucursalId, {
        estado:
          despacho.estado === EstadoDespacho.ENTREGADO
            ? EstadoComprobante.ENTREGADO
            : despacho.estado === EstadoDespacho.ENTREGADO_PARCIAL
              ? EstadoComprobante.ENTREGADO_PARCIAL
              : EstadoComprobante.PENDIENTE,
      });

      const actualizado = await this.findOne(despacho.id, sucursalId);
      await this.auditoriaService.registrar({
        modulo: 'despachos',
        accion: 'ENTREGAR_DESPACHO',
        entidad: 'despacho',
        entidad_id: despacho.id,
        empleado_id: empleadoId,
        sucursal_id: sucursalId,
        descripcion: `Despacho actualizado ${despacho.id}`,
        antes: { estado: estadoAntes },
        despues: {
          estado: actualizado.estado,
          remito_id: actualizado.remito_id,
          items: entregas.map((entrega) => ({
            despacho_item_id: entrega.item.id,
            descripcion: entrega.item.descripcion,
            cantidad_despachada: entrega.cantidad,
            motivo_pendiente: entrega.motivo_pendiente,
          })),
        },
      });
      return actualizado;
    } catch (error) {
      if (!transaccionConfirmada) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(sucursalId: string): Promise<Despacho[]> {
    return this.despachoRepo.find({
      where: { sucursal_id: sucursalId },
      relations: [
        'items',
        'items.comprobanteItem',
        'comprobante',
        'remito',
        'remito.items',
      ],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, sucursalId: string): Promise<Despacho> {
    const despacho = await this.despachoRepo.findOne({
      where: { id, sucursal_id: sucursalId },
      relations: [
        'items',
        'items.comprobanteItem',
        'comprobante',
        'remito',
        'remito.items',
      ],
    });
    if (!despacho) throw new NotFoundException('Despacho no encontrado');
    return despacho;
  }

  async anular(
    id: string,
    sucursalId: string,
    empleadoId: string,
    dto: AnularDespachoDto,
  ): Promise<Despacho> {
    const despacho = await this.findOne(id, sucursalId);
    if (despacho.estado === EstadoDespacho.ANULADO) {
      throw new BadRequestException('El despacho ya esta anulado');
    }

    const totalDespachado = despacho.items.reduce(
      (sum, item) => sum + Number(item.cantidad_despachada ?? 0),
      0,
    );
    if (totalDespachado > 0 || despacho.remito_id) {
      throw new BadRequestException(
        'No se puede anular un despacho con mercaderia entregada; use devolucion/nota de credito',
      );
    }

    // Solo anulamos despachos pendientes: no revertimos stock porque todavia no hubo entrega.
    despacho.estado = EstadoDespacho.ANULADO;
    despacho.observaciones = dto.motivo ?? despacho.observaciones;
    await this.despachoRepo.save(despacho);

    const anulado = await this.findOne(id, sucursalId);
    await this.auditoriaService.registrar({
      modulo: 'despachos',
      accion: 'ANULAR_DESPACHO',
      entidad: 'despacho',
      entidad_id: id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: dto.motivo ?? 'Despacho anulado',
      despues: { estado: anulado.estado, motivo: dto.motivo ?? null },
    });
    return anulado;
  }

  private validarComprobanteDespachable(comprobante: Comprobante): void {
    const tiposValidos = [
      TipoComprobante.VENTA,
      TipoComprobante.TICKET,
      TipoComprobante.FACTURA_A,
      TipoComprobante.FACTURA_B,
      TipoComprobante.FACTURA_C,
    ];
    if (!tiposValidos.includes(comprobante.tipo)) {
      throw new BadRequestException('Este tipo de comprobante no se puede despachar');
    }

    const estadosValidos = [
      EstadoComprobante.COBRADA,
      EstadoComprobante.EMITIDO,
      EstadoComprobante.EMITIDA,
      EstadoComprobante.ENTREGADO_PARCIAL,
    ];
    if (!estadosValidos.includes(comprobante.estado)) {
      throw new BadRequestException(
        'El comprobante debe estar cobrado o emitido para despachar',
      );
    }
  }

  private normalizarEntregas(dto: EntregarDespachoDto, despacho: Despacho) {
    return dto.items.map((entrega) => {
      const item = despacho.items.find((actual) => actual.id === entrega.despacho_item_id);
      if (!item) throw new BadRequestException('Item de despacho invalido');

      const cantidad = Number(entrega.cantidad_despachada);
      if (!Number.isFinite(cantidad) || cantidad < 0) {
        throw new BadRequestException('La cantidad despachada debe ser valida');
      }
      const pendienteActual = Number(item.cantidad_pendiente ?? 0);
      if (pendienteActual > 0 && cantidad < pendienteActual && !entrega.motivo_pendiente) {
        throw new BadRequestException(
          `Indique motivo pendiente para "${item.descripcion}"`,
        );
      }

      return {
        item,
        cantidad,
        motivo_pendiente: entrega.motivo_pendiente ?? null,
      };
    });
  }

  private async generarRemito(
    sucursalId: string,
    empleadoId: string,
    despacho: Despacho,
    entregas: ReturnType<DespachosService['normalizarEntregas']>,
  ): Promise<Comprobante> {
    const items = entregas
      .filter((entrega) => entrega.cantidad > 0)
      .map((entrega) => ({
        producto_id: entrega.item.producto_id,
        variante_id: entrega.item.variante_id,
        descripcion: entrega.item.descripcion,
        cantidad: entrega.cantidad,
        precio_unitario: 0,
      }));

    const dto: CreateComprobanteDto = {
      tipo: TipoComprobante.REMITO,
      estado: EstadoComprobante.ENTREGADO,
      comprobante_origen_id: despacho.comprobante_id,
      empleado_despachador_id: empleadoId,
      observaciones:
        despacho.estado === EstadoDespacho.ENTREGADO_PARCIAL
          ? 'Remito por entrega parcial de mercaderia'
          : 'Remito por entrega de mercaderia',
      items,
    };

    return this.comprobantesService.create(sucursalId, empleadoId, dto);
  }
}
