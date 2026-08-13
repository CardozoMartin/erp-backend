import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CajaService } from 'src/caja/caja.service';
import { ClientesService } from 'src/clientes/clientes.service';
import { TipoCliente } from 'src/clientes/entities/cliente.entity';
import { ArcaService } from 'src/arca/arca.service';
import { RespuestaCAE } from 'src/arca/arca-wsfev1.service';
import { calcularIvaDesdeItems, ItemParaIva } from 'src/arca/arca-iva.helper';
import { Producto } from 'src/producto/entities/producto.entity';
import { ComprobantesService } from 'src/comprobantes/comprobantes.service';
import { CreateComprobanteItemDto } from 'src/comprobantes/dto/create-comprobante.dto';
import { ComprobanteItem } from 'src/comprobantes/entities/comprobante-item.entity';
import {
  Comprobante,
  EstadoComprobante,
  TipoComprobante,
} from 'src/comprobantes/entities/comprobante.entity';
import { StockMovimientosService } from 'src/stock-movimientos/stock-movimientos.service';
import {
  CreateNotaCreditoDto,
  DestinoNotaCredito,
  NotaCreditoItemDto,
} from './dto/create-nota-credito.dto';

@Injectable()
export class NotasCreditoService {
  private readonly logger = new Logger(NotasCreditoService.name);

  constructor(
    private readonly comprobantesService: ComprobantesService,
    private readonly stockMovimientosService: StockMovimientosService,
    private readonly clientesService: ClientesService,
    private readonly cajaService: CajaService,
    private readonly arcaService: ArcaService,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
  ) {}

  async create(
    sucursalId: string,
    empleadoId: string,
    dto: CreateNotaCreditoDto,
  ): Promise<Comprobante> {
    // 1. Buscamos y validamos el comprobante que se quiere devolver.
    const origen = await this.comprobantesService.findOne(
      dto.comprobante_origen_id,
      sucursalId,
    );
    this.validarOrigen(origen);

    // 2. Armamos los items a devolver y controlamos que no superen lo ya vendido.
    const itemsNota = await this.construirItemsNota(sucursalId, origen, dto.items);
    if (!itemsNota.length) {
      throw new BadRequestException('La nota de credito debe tener al menos un item');
    }

    const destino = dto.destino ?? DestinoNotaCredito.SOLO_EMITIR;
    this.validarDestino(destino, origen, dto);

    // 3. Si el origen es una factura autorizada, la NC también necesita CAE.
    // Sobre ventas o tickets internos no corresponde: no son fiscales.
    const { respuestaCAE, errorArca } = await this.solicitarCAE(
      sucursalId,
      origen,
      itemsNota,
    );

    // 4. Creamos la nota como comprobante numerado independiente.
    const nota = await this.comprobantesService.create(sucursalId, empleadoId, {
      tipo: TipoComprobante.NOTA_CREDITO,
      estado: EstadoComprobante.EMITIDA,
      cliente_id: origen.cliente_id,
      comprobante_origen_id: origen.id,
      empleado_vendedor_id: origen.empleado_vendedor_id,
      empleado_cajero_id: empleadoId,
      codigo_fiscal: this.codigoNotaCreditoDesde(origen),
      // La NC se emite en el mismo punto de venta que el comprobante que anula.
      // Sin este dato el QR fiscal no se puede construir (ver QrAfipService).
      punto_venta: origen.punto_venta,
      numero_afip: respuestaCAE?.numeroCbte ?? null,
      cae: respuestaCAE?.cae ?? null,
      cae_vencimiento: respuestaCAE?.caeVencimiento?.toISOString() ?? null,
      observaciones: errorArca
        ? `Nota de credito de ${origen.numero} — SIN CAE: ${errorArca.slice(0, 400)}`
        : dto.observaciones ?? `Nota de credito de ${origen.numero}`,
      items: itemsNota,
    });

    // 4. Si corresponde, reingresamos stock. Esto cubre devoluciones fisicas.
    if (dto.reingresar_stock ?? true) {
      for (const item of nota.items) {
        await this.stockMovimientosService.registrarEntradaPorNotaCredito(
          sucursalId,
          empleadoId,
          {
            nota_credito_id: nota.id,
            item,
            cantidad: Number(item.cantidad),
          },
        );
      }
    }

    // 5. Aplicamos el destino contable: saldo a favor, reembolso o solo emision.
    if (destino === DestinoNotaCredito.SALDO_CUENTA) {
      await this.clientesService.registrarNotaCredito(origen.cliente_id!, {
        monto: Number(nota.total),
        descripcion: `Nota de credito ${nota.numero}`,
        comprobante_id: nota.id,
      });
      await this.comprobantesService.cambiarEstado(nota.id, sucursalId, {
        estado: EstadoComprobante.APLICADA,
      });
    }

    if (destino === DestinoNotaCredito.REEMBOLSO) {
      await this.cajaService.registrarEgreso({
        cajaId: dto.caja_id!,
        sucursalId,
        empleadoId,
        comprobanteId: nota.id,
        medioPagoId: dto.medio_pago_id ?? null,
        monto: Number(nota.total),
        referencia: dto.referencia ?? null,
        descripcion: `Reembolso por nota de credito ${nota.numero}`,
      });
      await this.comprobantesService.cambiarEstado(nota.id, sucursalId, {
        estado: EstadoComprobante.REEMBOLSADA,
      });
    }

    // 6. Marcamos el comprobante origen como devuelto si ya se devolvio todo.
    await this.actualizarEstadoOrigen(sucursalId, origen);

    return this.comprobantesService.findOne(nota.id, sucursalId);
  }

  async findAll(sucursalId: string): Promise<Comprobante[]> {
    return this.comprobantesService.findAll(sucursalId, TipoComprobante.NOTA_CREDITO);
  }

  async findByOrigen(
    sucursalId: string,
    comprobanteId: string,
  ): Promise<Comprobante[]> {
    const notas = await this.findAll(sucursalId);
    return notas.filter((nota) => nota.comprobante_origen_id === comprobanteId);
  }

  /** Código AFIP de la factura de origen, o null si no era fiscal */
  private codigoFacturaOrigen(origen: Comprobante): number | null {
    if (origen.tipo === TipoComprobante.FACTURA_A) return 1;
    if (origen.tipo === TipoComprobante.FACTURA_B) return 6;
    if (origen.tipo === TipoComprobante.FACTURA_C) return 11;
    return null;
  }

  /** Código fiscal de la NC según la letra de la factura corregida */
  private codigoNotaCreditoDesde(origen: Comprobante): string | null {
    const codigo = this.codigoFacturaOrigen(origen);
    if (codigo === 1) return '003';
    if (codigo === 6) return '008';
    if (codigo === 11) return '013';
    return null;
  }

  /**
   * Pide el CAE de la nota de crédito. Igual que en la facturación, un fallo de
   * AFIP no bloquea la emisión: la nota queda sin CAE y el motivo se asienta en
   * observaciones para poder reintentar.
   */
  private async solicitarCAE(
    sucursalId: string,
    origen: Comprobante,
    itemsNota: CreateComprobanteItemDto[],
  ): Promise<{ respuestaCAE: RespuestaCAE | null; errorArca: string | null }> {
    const codigoOrigen = this.codigoFacturaOrigen(origen);

    // Solo las facturas fiscales ya autorizadas generan NC con CAE
    if (!codigoOrigen || !origen.cae) {
      return { respuestaCAE: null, errorArca: null };
    }

    const total = this.round(
      itemsNota.reduce(
        (suma, item) =>
          suma +
          Number(item.cantidad) * Number(item.precio_unitario) -
          Number(item.descuento_monto ?? 0) +
          Number(item.recargo_monto ?? 0),
        0,
      ),
    );

    // La NC hereda el tratamiento de IVA de la factura que corrige
    const discriminaIva = codigoOrigen === 1 || codigoOrigen === 6;
    const totalesIva = discriminaIva
      ? calcularIvaDesdeItems(await this.itemsConAlicuota(itemsNota))
      : null;

    const cliente = origen.cliente_id
      ? await this.clientesService.findOne(origen.cliente_id)
      : null;

    try {
      const respuestaCAE = await this.arcaService.solicitarCAEParaNotaCredito(
        sucursalId,
        {
          puntoVenta: 0, // ArcaService lo lee de su config
          cuit: '',      // idem
          numero: 0,     // idem
          fechaCbte: this.fechaAfipLocal(),
          importeTotal: total,
          importeNeto: totalesIva?.neto ?? total,
          importeIva: totalesIva?.iva ?? 0,
          importeExento: totalesIva?.exento ?? 0,
          alicuotas: totalesIva?.alicuotas,
          cuitReceptor: cliente?.cuit ?? null,
          dniReceptor: cliente?.dni ?? null,
          condicionIvaReceptor: this.condicionIvaAfip(cliente?.tipo ?? null),
          codigoFacturaOrigen: codigoOrigen,
          numeroFacturaOrigen: Number(origen.numero_secuencial ?? 0),
          puntoVentaOrigen: Number(origen.punto_venta ?? 0),
        },
      );
      return { respuestaCAE, errorArca: null };
    } catch (err: unknown) {
      const errorArca = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `ARCA no autorizó la nota de crédito de ${origen.numero}: ${errorArca}`,
      );
      return { respuestaCAE: null, errorArca };
    }
  }

  /** Empareja cada item con la alícuota de su producto */
  private async itemsConAlicuota(
    items: CreateComprobanteItemDto[],
  ): Promise<ItemParaIva[]> {
    const ids = [
      ...new Set(items.map((i) => i.producto_id).filter((id): id is string => !!id)),
    ];
    const productos = ids.length
      ? await this.productoRepo.find({ where: { id: In(ids) }, select: ['id', 'alicuota_iva'] })
      : [];
    const porProducto = new Map(productos.map((p) => [p.id, Number(p.alicuota_iva)]));

    return items.map((item) => ({
      subtotal:
        Number(item.cantidad) * Number(item.precio_unitario) -
        Number(item.descuento_monto ?? 0) +
        Number(item.recargo_monto ?? 0),
      alicuota_iva: item.producto_id ? porProducto.get(item.producto_id) ?? 21 : 21,
    }));
  }

  /** YYYYMMDD en hora local: con UTC una venta nocturna se envía con fecha futura */
  private fechaAfipLocal(): string {
    const ahora = new Date();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${ahora.getFullYear()}${mes}${dia}`;
  }

  /** Condición IVA del receptor según AFIP (RG 5616) */
  private condicionIvaAfip(tipoCliente: TipoCliente | null): number {
    if (tipoCliente === TipoCliente.RESPONSABLE_INSCRIPTO) return 1;
    if (tipoCliente === TipoCliente.EXENTO) return 4;
    if (tipoCliente === TipoCliente.MONOTRIBUTISTA) return 6;
    return 5; // Consumidor Final
  }

  private validarOrigen(origen: Comprobante): void {
    const tiposValidos = [
      TipoComprobante.VENTA,
      TipoComprobante.TICKET,
      TipoComprobante.FACTURA_A,
      TipoComprobante.FACTURA_B,
      TipoComprobante.FACTURA_C,
    ];
    if (!tiposValidos.includes(origen.tipo)) {
      throw new BadRequestException('Solo se puede generar nota de credito sobre ventas, tickets o facturas');
    }

    const estadosInvalidos = [
      EstadoComprobante.BORRADOR,
      EstadoComprobante.PENDIENTE_COBRO,
      EstadoComprobante.CANCELADA,
      EstadoComprobante.ANULADO,
      EstadoComprobante.DEVUELTA,
    ];
    if (estadosInvalidos.includes(origen.estado)) {
      throw new BadRequestException('El comprobante origen no admite nota de credito');
    }
  }

  private validarDestino(
    destino: DestinoNotaCredito,
    origen: Comprobante,
    dto: CreateNotaCreditoDto,
  ): void {
    if (destino === DestinoNotaCredito.SALDO_CUENTA && !origen.cliente_id) {
      throw new BadRequestException(
        'Para dejar saldo a favor, el comprobante debe tener cliente',
      );
    }
    if (destino === DestinoNotaCredito.REEMBOLSO && !dto.caja_id) {
      throw new BadRequestException('Para reembolsar debe indicar caja_id');
    }
  }

  private async construirItemsNota(
    sucursalId: string,
    origen: Comprobante,
    itemsDto?: NotaCreditoItemDto[],
  ): Promise<CreateComprobanteItemDto[]> {
    const cantidadesYaDevueltas = await this.cantidadesDevueltasPorItem(
      sucursalId,
      origen.id,
    );
    const itemsSolicitados =
      itemsDto?.length
        ? itemsDto
        : origen.items.map((item) => ({
            comprobante_item_id: item.id,
            cantidad:
              Number(item.cantidad) - Number(cantidadesYaDevueltas.get(item.id) ?? 0),
          }));

    const itemsNota: CreateComprobanteItemDto[] = [];
    for (const itemDto of itemsSolicitados) {
      const itemOrigen = origen.items.find(
        (item) => item.id === itemDto.comprobante_item_id,
      );
      if (!itemOrigen) throw new BadRequestException('Item origen invalido');

      const cantidad = Number(itemDto.cantidad);
      if (cantidad <= 0) continue;

      const yaDevuelto = Number(cantidadesYaDevueltas.get(itemOrigen.id) ?? 0);
      const disponible = Number(itemOrigen.cantidad) - yaDevuelto;
      if (cantidad > disponible) {
        throw new BadRequestException(
          `La devolucion de "${itemOrigen.descripcion}" supera lo disponible (${disponible})`,
        );
      }

      itemsNota.push(this.crearItemNota(itemOrigen, cantidad));
    }

    return itemsNota;
  }

  private async cantidadesDevueltasPorItem(
    sucursalId: string,
    comprobanteOrigenId: string,
  ): Promise<Map<string, number>> {
    const notas = await this.findByOrigen(sucursalId, comprobanteOrigenId);
    const cantidades = new Map<string, number>();

    for (const nota of notas) {
      if (nota.estado === EstadoComprobante.ANULADO) continue;
      for (const item of nota.items ?? []) {
        if (!item.comprobante_item_origen_id) continue;
        cantidades.set(
          item.comprobante_item_origen_id,
          Number(cantidades.get(item.comprobante_item_origen_id) ?? 0) +
            Number(item.cantidad),
        );
      }
    }

    return cantidades;
  }

  private crearItemNota(
    itemOrigen: ComprobanteItem,
    cantidad: number,
  ): CreateComprobanteItemDto {
    const cantidadOrigen = Number(itemOrigen.cantidad);
    const proporcion = cantidadOrigen > 0 ? cantidad / cantidadOrigen : 0;

    return {
      producto_id: itemOrigen.producto_id,
      variante_id: itemOrigen.variante_id,
      comprobante_item_origen_id: itemOrigen.id,
      descripcion: itemOrigen.descripcion,
      cantidad,
      precio_unitario: Number(itemOrigen.precio_unitario),
      descuento_porcentaje: Number(itemOrigen.descuento_porcentaje ?? 0),
      descuento_monto: this.round(Number(itemOrigen.descuento_monto ?? 0) * proporcion),
      recargo_monto: this.round(Number(itemOrigen.recargo_monto ?? 0) * proporcion),
    };
  }

  private async actualizarEstadoOrigen(
    sucursalId: string,
    origen: Comprobante,
  ): Promise<void> {
    const cantidades = await this.cantidadesDevueltasPorItem(sucursalId, origen.id);
    const todoDevuelto = origen.items
      .filter((item) => item.producto_id)
      .every(
        (item) =>
          Number(cantidades.get(item.id) ?? 0) >= Number(item.cantidad ?? 0),
      );

    if (todoDevuelto) {
      await this.comprobantesService.cambiarEstado(origen.id, sucursalId, {
        estado: EstadoComprobante.DEVUELTA,
      });
    }
  }

  private round(value: number): number {
    return Number(Number(value).toFixed(2));
  }
}
