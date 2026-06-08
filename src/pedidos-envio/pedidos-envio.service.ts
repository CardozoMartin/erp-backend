import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { CajaService } from 'src/caja/caja.service';
import { EstadoCaja } from 'src/caja/entities/caja.entity';
import { ClientesService } from 'src/clientes/clientes.service';
import { ComprobantesService } from 'src/comprobantes/comprobantes.service';
import {
  EstadoComprobante,
  TipoComprobante,
} from 'src/comprobantes/entities/comprobante.entity';
import { ProductoService } from 'src/producto/producto.service';
import { PagosPosService } from 'src/pagos-pos/pagos-pos.service';
import { TipoPagoPos } from 'src/pagos-pos/entities/pago-pos.entity';
import { Repository } from 'typeorm';
import {
  CambiarEstadoPedidoEnvioDto,
  CrearPedidoEnvioDto,
  EditarPedidoEnvioDto,
  RendirPedidoEnvioDto,
} from './dto/pedido-envio.dto';
import {
  EstadoPagoPedidoEnvio,
  EstadoPedidoEnvio,
  MedioPagoPedidoEnvio,
  PedidoEnvio,
} from './entities/pedido-envio.entity';

@Injectable()
export class PedidosEnvioService {
  constructor(
    @InjectRepository(PedidoEnvio)
    private readonly pedidoRepo: Repository<PedidoEnvio>,
    private readonly cajaService: CajaService,
    private readonly clientesService: ClientesService,
    private readonly comprobantesService: ComprobantesService,
    private readonly pagosPosService: PagosPosService,
    private readonly productoService: ProductoService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async crear(
    sucursalId: string,
    empleadoId: string,
    dto: CrearPedidoEnvioDto,
  ): Promise<PedidoEnvio> {
    if (!dto.cliente_id && !dto.cliente_nuevo) {
      throw new BadRequestException('Debe seleccionar o crear un cliente');
    }
    if (!dto.items?.length) {
      throw new BadRequestException('Debe agregar al menos un producto');
    }
    const caja = await this.cajaService.findOne(dto.caja_id, sucursalId);
    if (caja.estado !== EstadoCaja.ABIERTA) {
      throw new BadRequestException('Debe seleccionar una caja abierta para crear el pedido');
    }

    const cliente = dto.cliente_id
      ? await this.clientesService.findOne(dto.cliente_id)
      : await this.clientesService.create(dto.cliente_nuevo!, empleadoId, sucursalId);

    const items = await Promise.all(
      dto.items.map(async (item) => {
        const producto = await this.productoService.findOne(item.producto_id, [sucursalId]);
        const precio = Number(item.precio_unitario ?? producto.precio_venta ?? producto.precio_base ?? 0);
        if (!Number.isFinite(precio) || precio < 0) {
          throw new BadRequestException(`Precio invalido para ${producto.nombre}`);
        }
        return {
          producto_id: producto.id,
          variante_id: item.variante_id ?? null,
          descripcion: producto.nombre,
          cantidad: Number(item.cantidad),
          precio_unitario: precio,
        };
      }),
    );

    const venta = await this.comprobantesService.create(sucursalId, empleadoId, {
      tipo: TipoComprobante.VENTA,
      estado: EstadoComprobante.PENDIENTE_COBRO,
      caja_id: caja.id,
      cliente_id: cliente.id,
      empleado_vendedor_id: empleadoId,
      observaciones: dto.observaciones ?? 'Pedido de envio',
      items,
    });

    const estadoPago = this.estadoPagoInicial(dto);
    const pedido = this.pedidoRepo.create({
      estado: EstadoPedidoEnvio.PENDIENTE,
      estado_pago: estadoPago,
      medio_pago_previsto: dto.medio_pago_previsto,
      comprobante_id: venta.id,
      sucursal_id: sucursalId,
      cliente_id: cliente.id,
      empleado_repartidor_id: dto.empleado_repartidor_id ?? null,
      direccion_entrega: dto.direccion_entrega.trim(),
      localidad_entrega: dto.localidad_entrega?.trim() || null,
      barrio_entrega: dto.barrio_entrega?.trim() || null,
      codigo_postal_entrega: dto.codigo_postal_entrega?.trim() || null,
      telefono_contacto: dto.telefono_contacto?.trim() || cliente.telefono || null,
      referencia_entrega: dto.referencia_entrega?.trim() || null,
      fecha_programada: dto.fecha_programada ? new Date(dto.fecha_programada) : null,
      referencia_pago: null,
      observaciones: dto.observaciones ?? null,
    });
    const guardado = await this.pedidoRepo.save(pedido);

    await this.auditoriaService.registrar({
      modulo: 'pedidos-envio',
      accion: 'CREAR_PEDIDO_ENVIO',
      entidad: 'pedido_envio',
      entidad_id: guardado.id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: `Pedido de envio creado para ${cliente.nombre}`,
      despues: {
        estado: guardado.estado,
        estado_pago: guardado.estado_pago,
        comprobante_id: venta.id,
        caja_id: caja.id,
        total: venta.total,
        cliente_id: cliente.id,
        direccion_entrega: guardado.direccion_entrega,
        medio_pago_previsto: dto.medio_pago_previsto,
        empleado_repartidor_id: dto.empleado_repartidor_id ?? null,
        items,
      },
      metadata: {
        cantidad_items: items.length,
        productos: items.map((item) => item.descripcion),
      },
    });

    return this.findOne(guardado.id, sucursalId);
  }

  async findAll(sucursalId: string): Promise<PedidoEnvio[]> {
    return this.pedidoRepo.find({
      where: { sucursal_id: sucursalId },
      relations: ['comprobante', 'comprobante.items'],
      order: { created_at: 'DESC' },
    });
  }

  async findByCaja(cajaId: string, sucursalId: string): Promise<PedidoEnvio[]> {
    await this.cajaService.findOne(cajaId, sucursalId);
    return this.pedidoRepo
      .createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.comprobante', 'comprobante')
      .leftJoinAndSelect('comprobante.items', 'items')
      .where('pedido.sucursal_id = :sucursalId', { sucursalId })
      .andWhere('comprobante.caja_id = :cajaId', { cajaId })
      .orderBy('pedido.created_at', 'DESC')
      .getMany();
  }

  async findOne(id: string, sucursalId: string): Promise<PedidoEnvio> {
    const pedido = await this.pedidoRepo.findOne({
      where: { id, sucursal_id: sucursalId },
      relations: ['comprobante', 'comprobante.items'],
    });
    if (!pedido) throw new NotFoundException('Pedido de envio no encontrado');
    return pedido;
  }

  async cambiarEstado(
    id: string,
    sucursalId: string,
    empleadoId: string,
    dto: CambiarEstadoPedidoEnvioDto,
  ): Promise<PedidoEnvio> {
    const pedido = await this.findOne(id, sucursalId);
    if (pedido.estado === EstadoPedidoEnvio.CANCELADO) {
      throw new BadRequestException('El pedido ya esta cancelado');
    }
    if (dto.estado === EstadoPedidoEnvio.EN_CAMINO && !pedido.empleado_repartidor_id && !dto.empleado_repartidor_id) {
      throw new BadRequestException('Debe asignar un repartidor para enviar el pedido');
    }

    const estadoAnterior = pedido.estado;
    const estadoPagoAnterior = pedido.estado_pago;
    const repartidorAnterior = pedido.empleado_repartidor_id;
    pedido.estado = dto.estado;
    pedido.empleado_repartidor_id = dto.empleado_repartidor_id ?? pedido.empleado_repartidor_id;
    pedido.observaciones = dto.observaciones ?? pedido.observaciones;
    if (dto.estado === EstadoPedidoEnvio.ENTREGADO) {
      pedido.fecha_entrega = new Date();
      if (pedido.medio_pago_previsto === MedioPagoPedidoEnvio.EFECTIVO && pedido.estado_pago === EstadoPagoPedidoEnvio.PENDIENTE_PAGO) {
        pedido.estado_pago = EstadoPagoPedidoEnvio.PENDIENTE_RENDICION;
      }
    }
    if (dto.estado === EstadoPedidoEnvio.CANCELADO) {
      await this.comprobantesService.cambiarEstado(pedido.comprobante_id, sucursalId, {
        estado: EstadoComprobante.CANCELADA,
        observaciones: dto.observaciones ?? 'Pedido de envio cancelado',
      }, empleadoId);
    }
    await this.pedidoRepo.save(pedido);

    await this.auditoriaService.registrar({
      modulo: 'pedidos-envio',
      accion: 'CAMBIAR_ESTADO_PEDIDO_ENVIO',
      entidad: 'pedido_envio',
      entidad_id: id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: `Estado del pedido cambiado de ${estadoAnterior} a ${pedido.estado}`,
      antes: {
        estado: estadoAnterior,
        estado_pago: estadoPagoAnterior,
        empleado_repartidor_id: repartidorAnterior,
      },
      despues: {
        estado: pedido.estado,
        estado_pago: pedido.estado_pago,
        empleado_repartidor_id: pedido.empleado_repartidor_id,
        fecha_entrega: pedido.fecha_entrega,
      },
      metadata: {
        observaciones: dto.observaciones ?? null,
      },
    });
    return this.findOne(id, sucursalId);
  }

  async editar(
    id: string,
    sucursalId: string,
    empleadoId: string,
    dto: EditarPedidoEnvioDto,
  ): Promise<PedidoEnvio> {
    const pedido = await this.findOne(id, sucursalId);
    if ([EstadoPedidoEnvio.CANCELADO, EstadoPedidoEnvio.ENTREGADO].includes(pedido.estado)) {
      throw new BadRequestException('No se puede editar un pedido entregado o cancelado');
    }
    if ([EstadoPagoPedidoEnvio.RENDIDO, EstadoPagoPedidoEnvio.PAGADO].includes(pedido.estado_pago)) {
      throw new BadRequestException('No se puede editar un pedido ya pagado o rendido');
    }
    if (!dto.items?.length) {
      throw new BadRequestException('El pedido debe tener al menos un producto');
    }
    const antes = this.snapshotPedido(pedido);

    const items = await Promise.all(
      dto.items.map(async (item) => {
        const producto = await this.productoService.findOne(item.producto_id, [sucursalId]);
        return {
          producto_id: producto.id,
          variante_id: item.variante_id ?? null,
          descripcion: producto.nombre,
          cantidad: Number(item.cantidad),
          precio_unitario: Number(item.precio_unitario ?? producto.precio_venta ?? producto.precio_base ?? 0),
        };
      }),
    );

    await this.comprobantesService.update(pedido.comprobante_id, sucursalId, {
      tipo: TipoComprobante.VENTA,
      cliente_id: pedido.cliente_id,
      observaciones: dto.observaciones ?? pedido.observaciones,
      items,
    }, empleadoId);

    pedido.empleado_repartidor_id = dto.empleado_repartidor_id ?? pedido.empleado_repartidor_id;
    pedido.medio_pago_previsto = dto.medio_pago_previsto ?? pedido.medio_pago_previsto;
    pedido.estado_pago = dto.estado_pago ?? pedido.estado_pago;
    pedido.direccion_entrega = dto.direccion_entrega?.trim() || pedido.direccion_entrega;
    pedido.localidad_entrega = dto.localidad_entrega?.trim() || null;
    pedido.barrio_entrega = dto.barrio_entrega?.trim() || null;
    pedido.codigo_postal_entrega = dto.codigo_postal_entrega?.trim() || null;
    pedido.telefono_contacto = dto.telefono_contacto?.trim() || null;
    pedido.referencia_entrega = dto.referencia_entrega?.trim() || null;
    pedido.fecha_programada = dto.fecha_programada ? new Date(dto.fecha_programada) : pedido.fecha_programada;
    pedido.observaciones = dto.observaciones ?? pedido.observaciones;
    await this.pedidoRepo.save(pedido);
    const pedidoActualizado = await this.findOne(id, sucursalId);
    const despues = this.snapshotPedido(pedidoActualizado);
    const cambiosItems = this.diffItems(antes.items, despues.items);

    await this.auditoriaService.registrar({
      modulo: 'pedidos-envio',
      accion: 'EDITAR_PEDIDO_ENVIO',
      entidad: 'pedido_envio',
      entidad_id: id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: 'Pedido de envio editado',
      antes,
      despues,
      metadata: {
        items_agregados: cambiosItems.agregados,
        items_eliminados: cambiosItems.eliminados,
        items_modificados: cambiosItems.modificados,
      },
    });
    return pedidoActualizado;
  }

  async rendir(
    id: string,
    sucursalId: string,
    empleadoId: string,
    dto: RendirPedidoEnvioDto,
  ): Promise<PedidoEnvio> {
    const pedido = await this.findOne(id, sucursalId);
    if (pedido.estado === EstadoPedidoEnvio.CANCELADO) {
      throw new BadRequestException('No se puede rendir un pedido cancelado');
    }
    if (pedido.estado_pago === EstadoPagoPedidoEnvio.RENDIDO) {
      throw new BadRequestException('El pedido ya fue rendido');
    }
    const antes = this.snapshotPedido(pedido);

    const monto = Number(dto.monto_rendido ?? pedido.comprobante.total ?? 0);
    if (pedido.comprobante.estado !== EstadoComprobante.COBRADA) {
      await this.pagosPosService.cobrar(pedido.comprobante_id, sucursalId, empleadoId, {
        caja_id: dto.caja_id,
        pagos: [
          {
            tipo: this.tipoPagoPos(pedido.medio_pago_previsto),
            medio_pago_id: dto.medio_pago_id,
            monto,
            referencia: dto.referencia_pago ?? null,
          },
        ],
      });
    }

    pedido.estado_pago = EstadoPagoPedidoEnvio.RENDIDO;
    pedido.fecha_rendicion = new Date();
    pedido.empleado_rendicion_id = empleadoId;
    pedido.monto_rendido = monto;
    pedido.referencia_pago = dto.referencia_pago ?? pedido.referencia_pago;
    pedido.observaciones = dto.observaciones ?? pedido.observaciones;
    await this.pedidoRepo.save(pedido);
    const pedidoRendido = await this.findOne(id, sucursalId);

    await this.auditoriaService.registrar({
      modulo: 'pedidos-envio',
      accion: 'RENDIR_PEDIDO_ENVIO',
      entidad: 'pedido_envio',
      entidad_id: id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: `Pedido rendido por ${monto}`,
      antes,
      despues: {
        estado_pago: pedido.estado_pago,
        monto_rendido: pedido.monto_rendido,
        referencia_pago: pedido.referencia_pago,
        empleado_rendicion_id: pedido.empleado_rendicion_id,
        fecha_rendicion: pedido.fecha_rendicion,
      },
      metadata: {
        caja_id: dto.caja_id,
        medio_pago_id: dto.medio_pago_id,
        observaciones: dto.observaciones ?? null,
      },
    });
    return pedidoRendido;
  }

  private estadoPagoInicial(dto: CrearPedidoEnvioDto): EstadoPagoPedidoEnvio {
    if (dto.estado_pago) return dto.estado_pago;
    if (dto.medio_pago_previsto === MedioPagoPedidoEnvio.TRANSFERENCIA) {
      return EstadoPagoPedidoEnvio.PAGADO;
    }
    return EstadoPagoPedidoEnvio.PENDIENTE_PAGO;
  }

  private tipoPagoPos(medio: MedioPagoPedidoEnvio): TipoPagoPos {
    if (medio === MedioPagoPedidoEnvio.TRANSFERENCIA) return TipoPagoPos.TRANSFERENCIA;
    if (medio === MedioPagoPedidoEnvio.EFECTIVO) return TipoPagoPos.EFECTIVO;
    return TipoPagoPos.OTRO;
  }

  private snapshotPedido(pedido: PedidoEnvio) {
    return {
      estado: pedido.estado,
      estado_pago: pedido.estado_pago,
      medio_pago_previsto: pedido.medio_pago_previsto,
      cliente_id: pedido.cliente_id,
      empleado_repartidor_id: pedido.empleado_repartidor_id,
      empleado_rendicion_id: pedido.empleado_rendicion_id,
      direccion_entrega: pedido.direccion_entrega,
      localidad_entrega: pedido.localidad_entrega,
      barrio_entrega: pedido.barrio_entrega,
      codigo_postal_entrega: pedido.codigo_postal_entrega,
      telefono_contacto: pedido.telefono_contacto,
      referencia_entrega: pedido.referencia_entrega,
      fecha_programada: pedido.fecha_programada,
      fecha_entrega: pedido.fecha_entrega,
      fecha_rendicion: pedido.fecha_rendicion,
      monto_rendido: pedido.monto_rendido,
      referencia_pago: pedido.referencia_pago,
      observaciones: pedido.observaciones,
      total: pedido.comprobante?.total ?? null,
      items: (pedido.comprobante?.items ?? []).map((item) => ({
        producto_id: item.producto_id,
        variante_id: item.variante_id,
        descripcion: item.descripcion,
        cantidad: Number(item.cantidad),
        precio_unitario: Number(item.precio_unitario),
        subtotal: Number(item.subtotal),
      })),
    };
  }

  private diffItems(antes: any[] = [], despues: any[] = []) {
    const key = (item: any) => `${item.producto_id ?? item.descripcion}:${item.variante_id ?? ''}`;
    const anteriores = new Map(antes.map((item) => [key(item), item]));
    const actuales = new Map(despues.map((item) => [key(item), item]));
    const agregados = despues.filter((item) => !anteriores.has(key(item)));
    const eliminados = antes.filter((item) => !actuales.has(key(item)));
    const modificados = despues
      .filter((item) => {
        const anterior = anteriores.get(key(item));
        return (
          anterior &&
          (Number(anterior.cantidad) !== Number(item.cantidad) ||
            Number(anterior.precio_unitario) !== Number(item.precio_unitario))
        );
      })
      .map((item) => ({
        antes: anteriores.get(key(item)),
        despues: item,
      }));

    return { agregados, eliminados, modificados };
  }
}
