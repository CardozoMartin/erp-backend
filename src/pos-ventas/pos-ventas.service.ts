import { BadRequestException, Injectable } from '@nestjs/common';
import { CajaService } from 'src/caja/caja.service';
import { ComprobantesService } from 'src/comprobantes/comprobantes.service';
import {
  Comprobante,
  EstadoComprobante,
  TipoComprobante,
} from 'src/comprobantes/entities/comprobante.entity';
import { ConfiguracionService } from 'src/configuracion/configuracion.service';
import { ModoPOS } from 'src/configuracion/entities/configuracion.entity';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { FacturacionService } from 'src/facturacion/facturacion.service';
import { ListaPrecio } from 'src/lista-precio/entities/lista-precio.entity';
import { NotasCreditoService } from 'src/notas-credito/notas-credito.service';
import { PagoPos } from 'src/pagos-pos/entities/pago-pos.entity';
import { PagosPosService } from 'src/pagos-pos/pagos-pos.service';
import {
  CancelarVentaPosDto,
  CobrarVentaPosDto,
  CrearVentaPosDto,
  DevolverVentaPosDto,
  EmitirDesdeVentaDto,
  VentaCuentaCorrientePosDto,
  VentaCompletaPosDto,
} from './dto/pos-venta.dto';
import { PosVentasQueryService } from './pos-ventas-query.service';

@Injectable()
export class PosVentasService {
  constructor(
    private readonly cajaService: CajaService,
    private readonly comprobantesService: ComprobantesService,
    private readonly pagosPosService: PagosPosService,
    private readonly facturacionService: FacturacionService,
    private readonly configuracionService: ConfiguracionService,
    private readonly notasCreditoService: NotasCreditoService,
    private readonly auditoriaService: AuditoriaService,
    readonly queryService: PosVentasQueryService,
  ) {}

  async crearVenta(
    sucursalId: string,
    empleadoId: string,
    dto: CrearVentaPosDto,
  ): Promise<Comprobante> {
    const config = await this.configuracionService.crearPorDefecto(sucursalId);
    this.validarModoPermiteVentaPendiente(config.modo_pos);

    // 1.- En modo caja centralizada/con despacho se requiere caja abierta
    if (
      config.modo_pos === ModoPOS.CAJA_CENTRALIZADA ||
      config.modo_pos === ModoPOS.CON_DESPACHO
    ) {
      const hayCajaAbierta = await this.cajaService.hayCajaAbiertaEnSucursal(sucursalId);
      if (!hayCajaAbierta) {
        throw new BadRequestException(
          'No hay una caja abierta en esta sucursal para recibir ventas pendientes',
        );
      }
    }

    // 2.- Estado inicial según modo POS
    const estadoInicial =
      config.modo_pos === ModoPOS.CAJA_CENTRALIZADA || config.modo_pos === ModoPOS.CON_DESPACHO
        ? EstadoComprobante.PENDIENTE_COBRO
        : EstadoComprobante.BORRADOR;

    // 3.- Crear la venta usando comprobantes como fuente única
    const venta = await this.comprobantesService.create(sucursalId, empleadoId, {
      ...dto,
      tipo: TipoComprobante.VENTA,
      estado: dto.estado ?? estadoInicial,
      empleado_vendedor_id: dto.empleado_vendedor_id ?? empleadoId,
    });
    await this.auditoriaService.registrar({
      modulo: 'pos',
      accion: 'CREAR_VENTA',
      entidad: 'comprobante',
      entidad_id: venta.id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: `Venta creada ${venta.numero}`,
      despues: { numero: venta.numero, total: venta.total, estado: venta.estado },
    });
    return venta;
  }

  async ventaCompleta(
    sucursalId: string,
    empleadoId: string,
    dto: VentaCompletaPosDto,
  ): Promise<{ venta: Comprobante; comprobanteFiscal?: Comprobante }> {
    const config = await this.configuracionService.crearPorDefecto(sucursalId);
    this.validarModoPermiteVentaCompleta(config.modo_pos);

    // 1.- Crear y cobrar en el mismo flujo (kiosco/caja simple)
    const venta = await this.comprobantesService.create(sucursalId, empleadoId, {
      ...dto,
      tipo: TipoComprobante.VENTA,
      estado: EstadoComprobante.PENDIENTE_COBRO,
      empleado_vendedor_id: dto.empleado_vendedor_id ?? empleadoId,
    });
    await this.auditoriaService.registrar({
      modulo: 'pos',
      accion: 'CREAR_VENTA',
      entidad: 'comprobante',
      entidad_id: venta.id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: `Venta creada ${venta.numero}`,
      despues: { numero: venta.numero, total: venta.total, estado: venta.estado },
    });

    const cobrada = await this.pagosPosService.cobrar(venta.id, sucursalId, empleadoId, dto.cobro);
    await this.auditoriaService.registrar({
      modulo: 'pos',
      accion: 'COBRAR_VENTA',
      entidad: 'comprobante',
      entidad_id: cobrada.id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: `Venta cobrada ${cobrada.numero}`,
      antes: { estado: venta.estado },
      despues: { estado: cobrada.estado, caja_id: cobrada.caja_id, total: cobrada.total },
    });

    const comprobanteFiscal = await this.emitirSiCorresponde(cobrada, sucursalId, empleadoId, dto);
    return comprobanteFiscal ? { venta: cobrada, comprobanteFiscal } : { venta: cobrada };
  }

  async crearVentaQr(
    sucursalId: string,
    empleadoId: string,
    dto: CrearVentaPosDto,
  ): Promise<Comprobante> {
    const venta = await this.comprobantesService.create(sucursalId, empleadoId, {
      ...dto,
      tipo: TipoComprobante.VENTA,
      estado: EstadoComprobante.PENDIENTE_COBRO,
      empleado_vendedor_id: dto.empleado_vendedor_id ?? empleadoId,
    });
    await this.auditoriaService.registrar({
      modulo: 'pos',
      accion: 'CREAR_VENTA_QR',
      entidad: 'comprobante',
      entidad_id: venta.id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: `Venta QR creada ${venta.numero}`,
      despues: { numero: venta.numero, total: venta.total, estado: venta.estado },
    });
    return venta;
  }

  async ventaCuentaCorriente(
    sucursalId: string,
    empleadoId: string,
    dto: VentaCuentaCorrientePosDto,
  ): Promise<{ venta: Comprobante }> {
    const config = await this.configuracionService.crearPorDefecto(sucursalId);
    this.validarModoPermiteVentaPendiente(config.modo_pos);
    if (!config.permitir_cuenta_corriente) {
      throw new BadRequestException(
        'La cuenta corriente no esta habilitada para esta sucursal',
      );
    }
    if (!dto.cliente_id) {
      throw new BadRequestException(
        'Seleccione un cliente para cargar la venta a cuenta corriente',
      );
    }

    const venta = await this.comprobantesService.create(sucursalId, empleadoId, {
      ...dto,
      tipo: TipoComprobante.VENTA,
      estado: EstadoComprobante.PENDIENTE_COBRO,
      empleado_vendedor_id: dto.empleado_vendedor_id ?? empleadoId,
    });
    await this.auditoriaService.registrar({
      modulo: 'pos',
      accion: 'CREAR_VENTA_CUENTA_CORRIENTE',
      entidad: 'comprobante',
      entidad_id: venta.id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: `Venta a cuenta corriente creada ${venta.numero}`,
      despues: { numero: venta.numero, total: venta.total, estado: venta.estado },
    });

    const cobrada = await this.pagosPosService.cobrarCuentaCorrienteSinCaja(
      venta.id,
      sucursalId,
      empleadoId,
    );
    await this.auditoriaService.registrar({
      modulo: 'pos',
      accion: 'COBRAR_VENTA_CUENTA_CORRIENTE',
      entidad: 'comprobante',
      entidad_id: cobrada.id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: `Venta cargada a cuenta corriente ${cobrada.numero}`,
      antes: { estado: venta.estado },
      despues: { estado: cobrada.estado, caja_id: cobrada.caja_id, total: cobrada.total },
    });

    return { venta: cobrada };
  }

  async cobrarVenta(
    id: string,
    sucursalId: string,
    empleadoId: string,
    dto: CobrarVentaPosDto,
  ): Promise<{ venta: Comprobante; comprobanteFiscal?: Comprobante }> {
    const config = await this.configuracionService.crearPorDefecto(sucursalId);
    this.validarModoPermiteCobroPendiente(config.modo_pos);

    // 1.- Cobro separado para caja centralizada
    const venta = await this.queryService.validarVenta(id, sucursalId);
    if (![EstadoComprobante.BORRADOR, EstadoComprobante.PENDIENTE_COBRO].includes(venta.estado)) {
      throw new BadRequestException('La venta no esta pendiente de cobro');
    }

    const cobrada = await this.pagosPosService.cobrar(venta.id, sucursalId, empleadoId, dto);
    await this.auditoriaService.registrar({
      modulo: 'pos',
      accion: 'COBRAR_VENTA',
      entidad: 'comprobante',
      entidad_id: cobrada.id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: `Venta cobrada ${cobrada.numero}`,
      antes: { estado: venta.estado },
      despues: { estado: cobrada.estado, caja_id: cobrada.caja_id, total: cobrada.total },
    });

    const comprobanteFiscal = await this.emitirSiCorresponde(cobrada, sucursalId, empleadoId, dto);
    return comprobanteFiscal ? { venta: cobrada, comprobanteFiscal } : { venta: cobrada };
  }

  async emitirComprobante(
    id: string,
    sucursalId: string,
    empleadoId: string,
    dto: EmitirDesdeVentaDto,
  ): Promise<Comprobante> {
    if (dto.venta_id !== id) {
      throw new BadRequestException('venta_id no coincide con la ruta');
    }
    const comprobante = await this.facturacionService.emitir(sucursalId, empleadoId, {
      ...dto.comprobante_fiscal,
      venta_id: id,
    });
    await this.auditoriaService.registrar({
      modulo: 'pos',
      accion: 'EMITIR_COMPROBANTE',
      entidad: 'comprobante',
      entidad_id: comprobante.id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: `Comprobante emitido ${comprobante.numero}`,
      despues: { tipo: comprobante.tipo, numero: comprobante.numero, venta_id: id },
    });
    return comprobante;
  }

  async cancelarVenta(
    id: string,
    sucursalId: string,
    empleadoId: string,
    dto: CancelarVentaPosDto,
  ): Promise<Comprobante> {
    const venta = await this.queryService.validarVenta(id, sucursalId);
    if (![EstadoComprobante.BORRADOR, EstadoComprobante.PENDIENTE_COBRO].includes(venta.estado)) {
      throw new BadRequestException('Solo se pueden cancelar ventas sin cobrar');
    }

    const cancelada = await this.comprobantesService.cambiarEstado(id, sucursalId, {
      estado: EstadoComprobante.CANCELADA,
      observaciones: dto.motivo ?? venta.observaciones,
    });
    await this.auditoriaService.registrar({
      modulo: 'pos',
      accion: 'CANCELAR_VENTA',
      entidad: 'comprobante',
      entidad_id: id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: dto.motivo ?? `Venta cancelada ${venta.numero}`,
      antes: { estado: venta.estado },
      despues: { estado: cancelada.estado },
    });
    return cancelada;
  }

  async devolverVenta(
    id: string,
    sucursalId: string,
    empleadoId: string,
    dto: DevolverVentaPosDto,
  ): Promise<Comprobante> {
    const venta = await this.queryService.validarVenta(id, sucursalId);
    const estadosPermitidos = [
      EstadoComprobante.COBRADA,
      EstadoComprobante.ENTREGADO_PARCIAL,
      EstadoComprobante.ENTREGADO,
    ];
    if (!estadosPermitidos.includes(venta.estado)) {
      throw new BadRequestException('Solo se pueden devolver ventas cobradas o ya despachadas');
    }

    const notaCredito = await this.notasCreditoService.create(sucursalId, empleadoId, {
      ...dto,
      comprobante_origen_id: id,
    });
    await this.auditoriaService.registrar({
      modulo: 'pos',
      accion: 'DEVOLVER_VENTA',
      entidad: 'comprobante',
      entidad_id: id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: `Devolucion sobre venta ${venta.numero}`,
      despues: {
        nota_credito_id: notaCredito.id,
        nota_credito_numero: notaCredito.numero,
        total: notaCredito.total,
      },
    });
    return notaCredito;
  }

  // Delegación al query service (para mantener compatibilidad en el controller)
  findAll(sucursalId: string, empleadoId?: string) {
    return this.queryService.findAll(sucursalId, empleadoId);
  }

  findAllPaginado(sucursalId: string, filtros: Parameters<PosVentasQueryService['findAllPaginado']>[1]) {
    return this.queryService.findAllPaginado(sucursalId, filtros);
  }

  pendientesCobro(sucursalId: string) {
    return this.queryService.pendientesCobro(sucursalId);
  }

  findOne(id: string, sucursalId: string, empleadoId?: string) {
    return this.queryService.findOne(id, sucursalId, empleadoId);
  }

  findAllGeneral(sucursalId: string, empleadoId?: string) {
    return this.queryService.findAllGeneral(sucursalId, empleadoId);
  }

  ventasPorCaja(cajaId: string, sucursalId: string) {
    return this.queryService.ventasPorCaja(cajaId, sucursalId);
  }

  // --- Helpers privados ---

  private validarModoPermiteVentaPendiente(modo: ModoPOS): void {
    if (modo === ModoPOS.SIMPLE || modo === ModoPOS.MULTICAJA) {
      throw new BadRequestException(
        'Este modo POS vende y cobra en el momento. Requiere un usuario vendedor-cajero y no permite enviar ventas pendientes',
      );
    }
  }

  private validarModoPermiteVentaCompleta(modo: ModoPOS): void {
    if (modo === ModoPOS.CAJA_CENTRALIZADA || modo === ModoPOS.CON_DESPACHO) {
      throw new BadRequestException(
        'Este modo POS separa venta y cobro. La venta debe enviarse a pendientes y cobrarse desde caja',
      );
    }
  }

  private validarModoPermiteCobroPendiente(modo: ModoPOS): void {
    if (modo === ModoPOS.SIMPLE || modo === ModoPOS.MULTICAJA) {
      throw new BadRequestException(
        'Este modo POS no trabaja con ventas pendientes. La venta debe cobrarse en el momento',
      );
    }
  }

  private async emitirSiCorresponde(
    venta: Comprobante,
    sucursalId: string,
    empleadoId: string,
    dto: CobrarVentaPosDto | VentaCompletaPosDto,
  ): Promise<Comprobante | undefined> {
    if (!dto.emitir_comprobante || !dto.comprobante_fiscal) return undefined;

    const comprobante = await this.facturacionService.emitir(sucursalId, empleadoId, {
      ...dto.comprobante_fiscal,
      venta_id: venta.id,
    });
    await this.auditoriaService.registrar({
      modulo: 'pos',
      accion: 'EMITIR_COMPROBANTE',
      entidad: 'comprobante',
      entidad_id: comprobante.id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: `Comprobante emitido ${comprobante.numero}`,
      despues: { tipo: comprobante.tipo, numero: comprobante.numero, venta_id: venta.id },
    });
    return comprobante;
  }
}
