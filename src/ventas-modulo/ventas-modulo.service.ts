// ventas/ventas.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VentasModulo } from './entities/ventas-modulo.entity';
import { VentaItem } from './entities/venta-item.entity';
import { VentaPago } from './entities/venta-pago.entity';
import { VentaHistorial } from './entities/venta-historial.entity';
import { ConfigPosService } from 'src/config-pos/config-pos.service';
import { PagosModuleService } from 'src/pagos-module/pagos-module.service';
import { CobrarVentaDto, CrearVentaDto } from './dto/create-ventas-modulo.dto';
import { EstadoVenta } from './enum/estado-venta.enum';
import { TipoDocumento } from './enum/tipo-documento.enum';
import { FlujoVenta } from './enum/flujo-venta.enum';

@Injectable()
export class VentasService {
  constructor(
    @InjectRepository(VentasModulo)
    private readonly ventaRepo: Repository<VentasModulo>,
    @InjectRepository(VentaItem)
    private readonly itemRepo: Repository<VentaItem>,
    @InjectRepository(VentaPago)
    private readonly pagoRepo: Repository<VentaPago>,
    @InjectRepository(VentaHistorial)
    private readonly historialRepo: Repository<VentaHistorial>,
    private readonly configPosService: ConfigPosService,
    private readonly pagosService: PagosModuleService,
  ) {}

  // ─── CREAR VENTA O COTIZACIÓN ───────────────────────────────────────────────
  async crear(dto: CrearVentaDto): Promise<VentasModulo> {
    if (!dto.sucursal_id) {
      throw new BadRequestException('La venta requiere una sucursal activa');
    }
    if (!dto.empleado_id) {
      throw new BadRequestException('La venta requiere un empleado activo');
    }

    const sucursalId = dto.sucursal_id;
    const empleadoId = dto.empleado_id;

    // 1. Obtener config de la sucursal
    const config = await this.configPosService.findBySucursal(sucursalId);

    // 2. Calcular items
    const items = dto.items.map((i) => {
      const descuento_monto = +(
        i.precio_unitario *
        i.cantidad *
        ((i.descuento_porcentaje ?? 0) / 100)
      ).toFixed(2);
      const total = +(i.precio_unitario * i.cantidad - descuento_monto).toFixed(
        2,
      );
      return this.itemRepo.create({
        ...i,
        descuento_porcentaje: i.descuento_porcentaje ?? 0,
        descuento_monto,
        total,
      });
    });

    // 3. Calcular totales
    const subtotal = +items
      .reduce((s, i) => s + i.precio_unitario * i.cantidad, 0)
      .toFixed(2);
    const descuento_total = +items
      .reduce((s, i) => s + i.descuento_monto, 0)
      .toFixed(2);
    const total = +(subtotal - descuento_total).toFixed(2);

    // 4. Crear venta
    const venta = this.ventaRepo.create({
      tipoDocumento: dto.tipoDocumento ?? TipoDocumento.VENTA,
      estado: EstadoVenta.ABIERTA,
      flujo: config.flujo,
      sucursal_id: sucursalId,
      empleado_id: empleadoId,
      cliente_id: dto.cliente_id ?? null,
      lista_precio_id: dto.lista_precio_id ?? config.listaPrecioDefaultId,
      subtotal,
      descuento_total,
      total,
      notas: dto.notas ?? null,
      items,
    });

    const ventaGuardada = await this.ventaRepo.save(venta);

    // 5. Registrar historial
    await this.registrarHistorial(
      ventaGuardada,
      EstadoVenta.ABIERTA,
      EstadoVenta.ABIERTA,
      empleadoId,
      'Venta creada',
    );

    // 6. Si flujo simple → pasa directo a pendiente_pago
    if (config.flujo === FlujoVenta.SIMPLE) {
      return this.cambiarEstado(
        ventaGuardada,
        EstadoVenta.PENDIENTE_PAGO,
        empleadoId,
        'Flujo simple',
      );
    }

    return ventaGuardada;
  }

  // ─── COBRAR VENTA ──────────────────────────────────────────────────────────
  async cobrar(
    ventaId: string,
    dto: CobrarVentaDto,
    sucursalActivaId?: string,
  ): Promise<VentasModulo> {
    if (!dto.cajero_id) {
      throw new BadRequestException('El cobro requiere un cajero activo');
    }

    const venta = await this.findOne(ventaId, sucursalActivaId);

    // Validar estado
    if (
      ![EstadoVenta.ABIERTA, EstadoVenta.PENDIENTE_PAGO].includes(venta.estado)
    ) {
      throw new BadRequestException(
        `La venta no está en estado válido para cobrar`,
      );
    }

    // Validar medios de pago
    const config = await this.configPosService.findBySucursal(
      venta.sucursal_id,
    );
    if (!config.permitePagoMixto && dto.pagos.length > 1) {
      throw new BadRequestException(`Esta sucursal no permite pago mixto`);
    }

    // Validar que los medios de pago estén activos en la sucursal
    for (const p of dto.pagos) {
      if (!config.mediosPagoActivos.includes(p.medio_pago_id)) {
        throw new BadRequestException(
          `El medio de pago no está habilitado en esta sucursal`,
        );
      }
    }

    // Validar monto total
    const totalPagado = +dto.pagos.reduce((s, p) => s + p.monto, 0).toFixed(2);
    if (totalPagado < venta.total) {
      throw new BadRequestException(
        `El monto pagado (${totalPagado}) es menor al total (${venta.total})`,
      );
    }

    // Guardar pagos
    for (const p of dto.pagos) {
      const medioPago = await this.pagosService.findOne(p.medio_pago_id);

      if (medioPago.requiereReferencia && !p.referencia) {
        throw new BadRequestException(
          `El medio de pago "${medioPago.nombre}" requiere referencia`,
        );
      }

      const pago = this.pagoRepo.create({
        venta,
        medioPago,
        monto: p.monto,
        referencia: p.referencia ?? null,
      });
      await this.pagoRepo.save(pago);
    }

    // Cambiar estado
    const cajeroId = dto.cajero_id;
    venta.cajero_id = cajeroId;
    const estadoSiguiente = config.requiereDespacho
      ? EstadoVenta.PENDIENTE_DESPACHO
      : EstadoVenta.PAGADA;

    return this.cambiarEstado(
      venta,
      estadoSiguiente,
      cajeroId,
      'Venta cobrada',
    );
  }

  // ─── CONVERTIR COTIZACIÓN A VENTA ─────────────────────────────────────────
  async convertirCotizacion(
    ventaId: string,
    empleadoId: string,
    sucursalActivaId?: string,
  ): Promise<VentasModulo> {
    const venta = await this.findOne(ventaId, sucursalActivaId);

    if (venta.tipoDocumento !== TipoDocumento.COTIZACION) {
      throw new BadRequestException(`El documento no es una cotización`);
    }
    if (
      venta.estado === EstadoVenta.CANCELADA ||
      venta.estado === EstadoVenta.VENCIDA
    ) {
      throw new BadRequestException(`La cotización está ${venta.estado}`);
    }

    venta.tipoDocumento = TipoDocumento.VENTA;
    venta.cotizacion_origen_id = venta.id;

    return this.cambiarEstado(
      venta,
      EstadoVenta.ABIERTA,
      empleadoId,
      'Convertida desde cotización',
    );
  }

  // ─── CANCELAR ──────────────────────────────────────────────────────────────
  async cancelar(
    ventaId: string,
    empleadoId: string,
    sucursalActivaId?: string,
    motivo?: string,
  ): Promise<VentasModulo> {
    const venta = await this.findOne(ventaId, sucursalActivaId);

    if ([EstadoVenta.PAGADA, EstadoVenta.DESPACHADA].includes(venta.estado)) {
      throw new BadRequestException(
        `No se puede cancelar una venta ${venta.estado}`,
      );
    }

    return this.cambiarEstado(
      venta,
      EstadoVenta.CANCELADA,
      empleadoId,
      motivo ?? 'Cancelada',
    );
  }

  // ─── DESPACHAR ─────────────────────────────────────────────────────────────
  async despachar(
    ventaId: string,
    empleadoId: string,
    sucursalActivaId?: string,
  ): Promise<VentasModulo> {
    const venta = await this.findOne(ventaId, sucursalActivaId);

    if (venta.estado !== EstadoVenta.PENDIENTE_DESPACHO) {
      throw new BadRequestException(`La venta no está pendiente de despacho`);
    }

    return this.cambiarEstado(
      venta,
      EstadoVenta.DESPACHADA,
      empleadoId,
      'Despachada',
    );
  }

  // ─── BUSCAR ────────────────────────────────────────────────────────────────
  async findOne(id: string, sucursalActivaId?: string): Promise<VentasModulo> {
    const venta = await this.ventaRepo.findOne({
      where: { id },
      relations: ['items', 'pagos', 'pagos.medioPago', 'historial'],
    });
    if (!venta) throw new NotFoundException(`Venta ${id} no encontrada`);
    if (sucursalActivaId && venta.sucursal_id !== sucursalActivaId) {
      throw new ForbiddenException(
        'No podes consultar ventas de una sucursal distinta a la activa',
      );
    }
    return venta;
  }

  async findBySucursal(
    sucursalId: string,
    sucursalActivaId?: string,
  ): Promise<VentasModulo[]> {
    if (sucursalActivaId && sucursalId !== sucursalActivaId) {
      throw new ForbiddenException(
        'No podes consultar ventas de una sucursal distinta a la activa',
      );
    }

    return this.ventaRepo.find({
      where: { sucursal_id: sucursalId },
      order: { created_at: 'DESC' },
    });
  }

  // ─── HELPERS ───────────────────────────────────────────────────────────────
  private async cambiarEstado(
    venta: VentasModulo,
    nuevoEstado: EstadoVenta,
    usuarioId: string,
    observacion?: string,
  ): Promise<VentasModulo> {
    const estadoAnterior = venta.estado;
    venta.estado = nuevoEstado;
    const ventaActualizada = await this.ventaRepo.save(venta);
    await this.registrarHistorial(
      ventaActualizada,
      estadoAnterior,
      nuevoEstado,
      usuarioId,
      observacion,
    );
    return ventaActualizada;
  }

  private async registrarHistorial(
    venta: VentasModulo,
    estadoAnterior: EstadoVenta,
    estadoNuevo: EstadoVenta,
    usuarioId: string,
    observacion?: string,
  ): Promise<void> {
    const historial = this.historialRepo.create({
      venta,
      estado_anterior: estadoAnterior,
      estado_nuevo: estadoNuevo,
      usuario_id: usuarioId,
      observacion: observacion ?? null,
    });
    await this.historialRepo.save(historial);
  }
}
