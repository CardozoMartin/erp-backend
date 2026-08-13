import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ClientesService } from 'src/clientes/clientes.service';
import { TipoCliente } from 'src/clientes/entities/cliente.entity';
import { ComprobantesService } from 'src/comprobantes/comprobantes.service';
import {
  Comprobante,
  EstadoComprobante,
  TipoComprobante,
} from 'src/comprobantes/entities/comprobante.entity';
import { ArcaService } from 'src/arca/arca.service';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Producto } from 'src/producto/entities/producto.entity';
import { calcularIvaDesdeItems, ItemParaIva } from 'src/arca/arca-iva.helper';
import {
  AnularComprobanteFiscalDto,
  EmitirComprobanteFiscalDto,
  TipoEmisionFiscal,
  tipoFiscalAComprobante,
} from './dto/emitir-comprobante-fiscal.dto';

@Injectable()
export class FacturacionService {
  private readonly logger = new Logger(FacturacionService.name);

  constructor(
    private readonly comprobantesService: ComprobantesService,
    private readonly clientesService: ClientesService,
    private readonly arcaService: ArcaService,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
  ) {}

  async emitir(
    sucursalId: string,
    empleadoId: string,
    dto: EmitirComprobanteFiscalDto,
  ): Promise<Comprobante> {
    // 1. La facturacion se emite desde una venta ya cobrada.
    const venta = await this.comprobantesService.findOne(dto.venta_id, sucursalId);
    this.validarVentaFacturable(venta);

    const tipo = tipoFiscalAComprobante(dto.tipo);
    await this.validarNoDuplicado(sucursalId, venta.id, tipo);
    await this.validarClienteSegunTipo(dto, venta);

    // 2. Solicitar CAE a ARCA si está activo para la sucursal (si no, queda en null = manual)
    const clienteId = dto.cliente_id ?? venta.cliente_id;
    const cliente   = clienteId ? await this.clientesService.findOne(clienteId) : null;
    const totalVenta = Number(venta.total ?? 0);

    // Desglose real de IVA a partir de la alícuota de cada producto (21 / 10.5 /
    // exento). La Factura C no discrimina IVA, así que ahí no hace falta.
    const discriminaIva =
      tipo === TipoComprobante.FACTURA_A || tipo === TipoComprobante.FACTURA_B;
    const totalesIva = discriminaIva
      ? calcularIvaDesdeItems(await this.itemsConAlicuota(venta))
      : null;

    // El TICKET es un recibo interno, no un comprobante fiscal: no consume
    // numeración de AFIP ni lleva CAE. Solo las facturas se autorizan.
    let respuestaCAE: Awaited<
      ReturnType<typeof this.arcaService.solicitarCAEParaVenta>
    > = null;
    let errorArca: string | null = null;

    if (tipo !== TipoComprobante.TICKET) {
      try {
        respuestaCAE = await this.arcaService.solicitarCAEParaVenta(sucursalId, {
          tipo,
          puntoVenta:           0, // ArcaService lo lee de su config
          cuit:                 '', // ArcaService lo lee de su config
          numero:               0, // ArcaService consulta el último autorizado a AFIP
          fechaCbte:            this.fechaAfipLocal(),
          importeTotal:         totalVenta,
          importeNeto:          totalesIva?.neto ?? totalVenta,
          importeIva:           totalesIva?.iva ?? 0,
          importeExento:        totalesIva?.exento ?? 0,
          alicuotas:            totalesIva?.alicuotas,
          cuitReceptor:         cliente?.cuit ?? null,
          dniReceptor:          cliente?.dni  ?? null,
          condicionIvaReceptor: this.condicionIvaAfip(cliente?.tipo ?? null),
        });
      } catch (err: unknown) {
        // No bloqueamos la emisión: el comprobante queda sin CAE, pero dejamos
        // el motivo asentado en observaciones para poder reintentar después.
        errorArca = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `ARCA no autorizó el comprobante de la venta ${venta.numero}: ${errorArca}`,
        );
      }
    }

    // 3. Copiamos items y totales comerciales desde la venta. No validamos stock de nuevo.
    const comprobante = await this.comprobantesService.create(sucursalId, empleadoId, {
      tipo,
      estado:
        tipo === TipoComprobante.TICKET
          ? EstadoComprobante.EMITIDO
          : EstadoComprobante.EMITIDA,
      caja_id: venta.caja_id,
      cliente_id: clienteId,
      empleado_vendedor_id: venta.empleado_vendedor_id,
      empleado_cajero_id: venta.empleado_cajero_id ?? empleadoId,
      comprobante_origen_id: venta.id,
      lista_precio_id: venta.lista_precio_id,
      descuento_global_porcentaje: Number(venta.descuento_global_porcentaje ?? 0),
      descuento_global_monto: Number(venta.descuento_global_monto ?? 0),
      recargo_total: Number(venta.recargo_total ?? 0),
      codigo_fiscal: dto.codigo_fiscal ?? this.codigoFiscalDefault(tipo),
      // El número lo define AFIP al autorizar; el contador local se alinea a él
      numero_afip:    respuestaCAE?.numeroCbte ?? null,
      cae:            respuestaCAE?.cae ?? dto.cae ?? null,
      cae_vencimiento: respuestaCAE?.caeVencimiento?.toISOString() ?? dto.cae_vencimiento ?? null,
      observaciones: errorArca
        ? `${dto.tipo} emitido desde ${venta.numero} — SIN CAE: ${errorArca.slice(0, 400)}`
        : dto.observaciones ?? `${dto.tipo} emitido desde ${venta.numero}`,
      omitir_validacion_stock: true,
      items: venta.items.map((item) => ({
        producto_id: item.producto_id,
        variante_id: item.variante_id,
        comprobante_item_origen_id: item.id,
        descripcion: item.descripcion,
        cantidad: Number(item.cantidad),
        precio_unitario: Number(item.precio_unitario),
        descuento_porcentaje: Number(item.descuento_porcentaje ?? 0),
        descuento_monto: Number(item.descuento_monto ?? 0),
        recargo_monto: Number(item.recargo_monto ?? 0),
      })),
    });

    return comprobante;
  }

  async findAll(sucursalId: string): Promise<Comprobante[]> {
    const comprobantes = await this.comprobantesService.findAll(sucursalId);
    return comprobantes.filter((comprobante) => this.esFiscal(comprobante.tipo));
  }

  async findByVenta(
    sucursalId: string,
    ventaId: string,
  ): Promise<Comprobante[]> {
    const comprobantes = await this.findAll(sucursalId);
    return comprobantes.filter(
      (comprobante) => comprobante.comprobante_origen_id === ventaId,
    );
  }

  async anular(
    id: string,
    sucursalId: string,
    dto: AnularComprobanteFiscalDto,
  ): Promise<Comprobante> {
    const comprobante = await this.comprobantesService.findOne(id, sucursalId);
    if (!this.esFiscal(comprobante.tipo)) {
      throw new BadRequestException('Solo se pueden anular tickets o facturas');
    }
    if (comprobante.estado === EstadoComprobante.ANULADO) {
      throw new BadRequestException('El comprobante fiscal ya esta anulado');
    }

    // Anular el fiscal no toca stock ni caja: si hay devolucion real va por nota de credito.
    return this.comprobantesService.cambiarEstado(id, sucursalId, {
      estado: EstadoComprobante.ANULADO,
      observaciones: dto.motivo ?? comprobante.observaciones,
    });
  }

  private validarVentaFacturable(venta: Comprobante): void {
    if (venta.tipo !== TipoComprobante.VENTA) {
      throw new BadRequestException('Solo se emite ticket/factura desde una venta');
    }
    const estadosFacturables = [
      EstadoComprobante.COBRADA,
      EstadoComprobante.ENTREGADO_PARCIAL,
      EstadoComprobante.ENTREGADO,
    ];
    if (!estadosFacturables.includes(venta.estado)) {
      throw new BadRequestException(
        'La venta debe estar cobrada o despachada para facturar',
      );
    }
    if (!venta.items?.length) {
      throw new BadRequestException('La venta no tiene items para facturar');
    }
  }

  /**
   * Un ticket interno no impide facturar después: es habitual entregar el
   * ticket al cobrar y emitir la factura recién cuando el cliente la pide.
   * Lo que no se puede duplicar es el comprobante fiscal (con o sin CAE).
   */
  private async validarNoDuplicado(
    sucursalId: string,
    ventaId: string,
    tipo: TipoComprobante,
  ): Promise<void> {
    const emitidos = await this.findByVenta(sucursalId, ventaId);
    const vigentes = emitidos.filter(
      (comprobante) => comprobante.estado !== EstadoComprobante.ANULADO,
    );

    if (tipo === TipoComprobante.TICKET) {
      const ticket = vigentes.find((c) => c.tipo === TipoComprobante.TICKET);
      if (ticket) {
        throw new BadRequestException(
          `La venta ya tiene un ticket emitido: ${ticket.numero}`,
        );
      }
      return;
    }

    const factura = vigentes.find((c) => c.tipo !== TipoComprobante.TICKET);
    if (factura) {
      throw new BadRequestException(
        `La venta ya tiene una factura emitida: ${factura.numero}`,
      );
    }
  }

  /** Monto desde el cual AFIP exige identificar al consumidor final (RG 4444) */
  private readonly TOPE_CONSUMIDOR_FINAL = 417_000;

  private async validarClienteSegunTipo(
    dto: EmitirComprobanteFiscalDto,
    venta: Comprobante,
  ): Promise<void> {
    if (dto.tipo === TipoEmisionFiscal.TICKET) return;

    const clienteId = dto.cliente_id ?? venta.cliente_id;

    // La Factura A siempre necesita un CUIT: identifica a un Responsable Inscripto.
    if (dto.tipo === TipoEmisionFiscal.FACTURA_A && !clienteId) {
      throw new BadRequestException(
        'Factura A requiere un cliente Responsable Inscripto con CUIT',
      );
    }

    // B y C a consumidor final no requieren identificar al receptor por debajo
    // del tope de AFIP: se emiten con DocTipo 99 / DocNro 0.
    if (!clienteId) {
      const total = Number(venta.total ?? 0);
      if (total >= this.TOPE_CONSUMIDOR_FINAL) {
        throw new BadRequestException(
          `Por montos desde $${this.TOPE_CONSUMIDOR_FINAL.toLocaleString('es-AR')} hay que identificar al cliente`,
        );
      }
      return;
    }

    const cliente = await this.clientesService.findOne(clienteId);

    if (dto.tipo === TipoEmisionFiscal.FACTURA_A) {
      if (cliente.tipo !== TipoCliente.RESPONSABLE_INSCRIPTO) {
        throw new BadRequestException(
          'Factura A requiere cliente Responsable Inscripto',
        );
      }
      if (!cliente.cuit) {
        throw new BadRequestException('El cliente de una Factura A debe tener CUIT');
      }
    }
  }

  private esFiscal(tipo: TipoComprobante): boolean {
    return [
      TipoComprobante.TICKET,
      TipoComprobante.FACTURA_A,
      TipoComprobante.FACTURA_B,
      TipoComprobante.FACTURA_C,
    ].includes(tipo);
  }

  private codigoFiscalDefault(tipo: TipoComprobante): string | null {
    if (tipo === TipoComprobante.FACTURA_A) return '001';
    if (tipo === TipoComprobante.FACTURA_B) return '006';
    if (tipo === TipoComprobante.FACTURA_C) return '011';
    return null;
  }

  /**
   * Fecha del comprobante en YYYYMMDD, hora local.
   * Con `toISOString()` una venta hecha después de las 21:00 se enviaría con la
   * fecha del día siguiente (UTC) y AFIP la rechaza por estar en el futuro.
   */
  private fechaAfipLocal(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  }

  /**
   * Código de condición IVA del receptor — tabla FEParamGetCondicionIvaReceptor.
   * Obligatorio en el CAE desde la RG 5616.
   */
  /**
   * Empareja cada item de la venta con la alícuota de su producto. Los items no
   * la guardan, así que se leen los productos en una sola consulta. Un item sin
   * producto (descripción libre) cae en la alícuota general.
   */
  private async itemsConAlicuota(venta: Comprobante): Promise<ItemParaIva[]> {
    const ids = [
      ...new Set(venta.items.map((i) => i.producto_id).filter((id): id is string => !!id)),
    ];

    const productos = ids.length
      ? await this.productoRepo.find({
          where: { id: In(ids) },
          select: ['id', 'alicuota_iva'],
        })
      : [];

    const alicuotaPorProducto = new Map(
      productos.map((p) => [p.id, Number(p.alicuota_iva)]),
    );

    return venta.items.map((item) => ({
      subtotal: Number(item.subtotal ?? 0),
      alicuota_iva: item.producto_id
        ? alicuotaPorProducto.get(item.producto_id) ?? 21
        : 21,
    }));
  }

  private condicionIvaAfip(tipoCliente: TipoCliente | null): number {
    if (tipoCliente === TipoCliente.RESPONSABLE_INSCRIPTO) return 1;
    if (tipoCliente === TipoCliente.EXENTO)                return 4;
    if (tipoCliente === TipoCliente.MONOTRIBUTISTA)        return 6;
    return 5; // Consumidor Final (default)
  }
}
