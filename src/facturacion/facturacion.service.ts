import { BadRequestException, Injectable } from '@nestjs/common';
import { ClientesService } from 'src/clientes/clientes.service';
import { TipoCliente } from 'src/clientes/entities/cliente.entity';
import { ComprobantesService } from 'src/comprobantes/comprobantes.service';
import {
  Comprobante,
  EstadoComprobante,
  TipoComprobante,
} from 'src/comprobantes/entities/comprobante.entity';
import {
  AnularComprobanteFiscalDto,
  EmitirComprobanteFiscalDto,
  TipoEmisionFiscal,
  tipoFiscalAComprobante,
} from './dto/emitir-comprobante-fiscal.dto';

@Injectable()
export class FacturacionService {
  constructor(
    private readonly comprobantesService: ComprobantesService,
    private readonly clientesService: ClientesService,
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
    await this.validarNoDuplicado(sucursalId, venta.id);
    await this.validarClienteSegunTipo(dto, venta);

    // 2. Copiamos items y totales comerciales desde la venta. No validamos stock de nuevo.
    const comprobante = await this.comprobantesService.create(sucursalId, empleadoId, {
      tipo,
      estado:
        tipo === TipoComprobante.TICKET
          ? EstadoComprobante.EMITIDO
          : EstadoComprobante.EMITIDA,
      caja_id: venta.caja_id,
      cliente_id: dto.cliente_id ?? venta.cliente_id,
      empleado_vendedor_id: venta.empleado_vendedor_id,
      empleado_cajero_id: venta.empleado_cajero_id ?? empleadoId,
      comprobante_origen_id: venta.id,
      lista_precio_id: venta.lista_precio_id,
      descuento_global_porcentaje: Number(venta.descuento_global_porcentaje ?? 0),
      descuento_global_monto: Number(venta.descuento_global_monto ?? 0),
      recargo_total: Number(venta.recargo_total ?? 0),
      codigo_fiscal: dto.codigo_fiscal ?? this.codigoFiscalDefault(tipo),
      cae: dto.cae ?? null,
      cae_vencimiento: dto.cae_vencimiento ?? null,
      observaciones: dto.observaciones ?? `${dto.tipo} emitido desde ${venta.numero}`,
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

  private async validarNoDuplicado(
    sucursalId: string,
    ventaId: string,
  ): Promise<void> {
    const emitidos = await this.findByVenta(sucursalId, ventaId);
    const vigente = emitidos.find(
      (comprobante) => comprobante.estado !== EstadoComprobante.ANULADO,
    );
    if (vigente) {
      throw new BadRequestException(
        `La venta ya tiene un comprobante emitido: ${vigente.numero}`,
      );
    }
  }

  private async validarClienteSegunTipo(
    dto: EmitirComprobanteFiscalDto,
    venta: Comprobante,
  ): Promise<void> {
    if (dto.tipo === TipoEmisionFiscal.TICKET) return;

    const clienteId = dto.cliente_id ?? venta.cliente_id;
    if (!clienteId) {
      throw new BadRequestException('Para emitir factura debe indicar cliente');
    }

    const cliente = await this.clientesService.findOne(clienteId);
    if (!cliente.cuit && !cliente.dni) {
      throw new BadRequestException('El cliente debe tener CUIT o DNI para facturar');
    }

    if (
      dto.tipo === TipoEmisionFiscal.FACTURA_A &&
      cliente.tipo !== TipoCliente.RESPONSABLE_INSCRIPTO
    ) {
      throw new BadRequestException(
        'Factura A requiere cliente Responsable Inscripto',
      );
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
}
