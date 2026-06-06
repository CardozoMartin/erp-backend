import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
import { Empleado } from 'src/empleados/entities/empleado.entity';
import { FacturacionService } from 'src/facturacion/facturacion.service';
import { ListaPrecio } from 'src/lista-precio/entities/lista-precio.entity';
import { ListaPrecioService } from 'src/lista-precio/lista-precio.service';
import { NotasCreditoService } from 'src/notas-credito/notas-credito.service';
import { PagoPos } from 'src/pagos-pos/entities/pago-pos.entity';
import { PagosPosService } from 'src/pagos-pos/pagos-pos.service';
import { Producto } from 'src/producto/entities/producto.entity';
import { In, Repository } from 'typeorm';
import {
  CancelarVentaPosDto,
  CobrarVentaPosDto,
  CrearVentaPosDto,
  DevolverVentaPosDto,
  EmitirDesdeVentaDto,
  VentaCompletaPosDto,
} from './dto/pos-venta.dto';

@Injectable()
export class PosVentasService {
  constructor(
    @InjectRepository(Empleado)
    private readonly empleadoRepo: Repository<Empleado>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    private readonly cajaService: CajaService,
    private readonly comprobantesService: ComprobantesService,
    private readonly pagosPosService: PagosPosService,
    private readonly facturacionService: FacturacionService,
    private readonly configuracionService: ConfiguracionService,
    private readonly notasCreditoService: NotasCreditoService,
    private readonly auditoriaService: AuditoriaService,
    private readonly listaPrecioService: ListaPrecioService,
  ) {}

  async crearVenta(
    sucursalId: string,
    empleadoId: string,
    dto: CrearVentaPosDto,
  ): Promise<Comprobante> {
    const config = await this.configuracionService.crearPorDefecto(sucursalId);
    this.validarModoPermiteVentaPendiente(config.modo_pos);

    // 1. En modo caja centralizada/con despacho, la venta queda para cobrar despues.
    if (
      config.modo_pos === ModoPOS.CAJA_CENTRALIZADA ||
      config.modo_pos === ModoPOS.CON_DESPACHO
    ) {
      const hayCajaAbierta = await this.cajaService.hayCajaAbiertaEnSucursal(
        sucursalId,
      );
      if (!hayCajaAbierta) {
        throw new BadRequestException(
          'No hay una caja abierta en esta sucursal para recibir ventas pendientes',
        );
      }
    }

    // 2. En modo caja centralizada/con despacho, la venta queda para cobrar despues.
    const estadoInicial =
      config.modo_pos === ModoPOS.CAJA_CENTRALIZADA ||
      config.modo_pos === ModoPOS.CON_DESPACHO
        ? EstadoComprobante.PENDIENTE_COBRO
        : EstadoComprobante.BORRADOR;

    // 3. Creamos una VENTA real usando comprobantes como fuente unica.
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

    // 1. Flujo rapido para kiosco/caja simple: crea la venta y la cobra al instante.
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

    const cobrada = await this.pagosPosService.cobrar(
      venta.id,
      sucursalId,
      empleadoId,
      dto.cobro,
    );
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

    const comprobanteFiscal = await this.emitirSiCorresponde(
      cobrada,
      sucursalId,
      empleadoId,
      dto,
    );

    return comprobanteFiscal
      ? { venta: cobrada, comprobanteFiscal }
      : { venta: cobrada };
  }

  async cobrarVenta(
    id: string,
    sucursalId: string,
    empleadoId: string,
    dto: CobrarVentaPosDto,
  ): Promise<{ venta: Comprobante; comprobanteFiscal?: Comprobante }> {
    const config = await this.configuracionService.crearPorDefecto(sucursalId);
    this.validarModoPermiteCobroPendiente(config.modo_pos);

    // 1. Cobro separado para caja centralizada: el vendedor dejo la venta pendiente.
    const venta = await this.validarVenta(id, sucursalId);
    if (![EstadoComprobante.BORRADOR, EstadoComprobante.PENDIENTE_COBRO].includes(venta.estado)) {
      throw new BadRequestException('La venta no esta pendiente de cobro');
    }

    const cobrada = await this.pagosPosService.cobrar(
      venta.id,
      sucursalId,
      empleadoId,
      dto,
    );
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

    const comprobanteFiscal = await this.emitirSiCorresponde(
      cobrada,
      sucursalId,
      empleadoId,
      dto,
    );

    return comprobanteFiscal
      ? { venta: cobrada, comprobanteFiscal }
      : { venta: cobrada };
  }

  async emitirComprobante(
    id: string,
    sucursalId: string,
    empleadoId: string,
    dto: EmitirDesdeVentaDto,
  ): Promise<Comprobante> {
    // 1. Endpoint explicito para emitir ticket/factura despues del cobro.
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
    const venta = await this.validarVenta(id, sucursalId);
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
    const venta = await this.validarVenta(id, sucursalId);
    const estadosPermitidos = [
      EstadoComprobante.COBRADA,
      EstadoComprobante.ENTREGADO_PARCIAL,
      EstadoComprobante.ENTREGADO,
    ];
    if (!estadosPermitidos.includes(venta.estado)) {
      throw new BadRequestException(
        'Solo se pueden devolver ventas cobradas o ya despachadas',
      );
    }

    // La devolucion operativa del POS siempre se documenta con nota de credito.
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

  async findAll(sucursalId: string, empleadoId?: string): Promise<Comprobante[]> {
    const ventas = await this.comprobantesService.findAll(sucursalId, TipoComprobante.VENTA);
    if (!empleadoId) return ventas;
    return ventas.filter(
      (venta) =>
        venta.empleado_vendedor_id === empleadoId ||
        venta.empleado_cajero_id === empleadoId,
    );
  }

  async findAllPaginado(
    sucursalId: string,
    filtros: {
      page?: number;
      limit?: number;
      desde?: string;
      hasta?: string;
      empleadoId?: string;
    },
  ): Promise<{
    data: Comprobante[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = Math.max(1, Number(filtros.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filtros.limit || 50)));
    const desde = filtros.desde ? new Date(`${filtros.desde}T00:00:00`) : null;
    const hasta = filtros.hasta ? new Date(`${filtros.hasta}T23:59:59.999`) : null;

    let ventas = await this.findAll(sucursalId, filtros.empleadoId);
    ventas = ventas.filter((venta) => {
      const fecha = new Date(venta.created_at);
      if (desde && fecha < desde) return false;
      if (hasta && fecha > hasta) return false;
      return true;
    });

    const total = ventas.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;

    return {
      data: ventas.slice(start, start + limit),
      meta: { page, limit, total, totalPages },
    };
  }

  async pendientesCobro(sucursalId: string): Promise<Comprobante[]> {
    const ventas = await this.findAll(sucursalId);
    return ventas.filter((venta) =>
      [EstadoComprobante.BORRADOR, EstadoComprobante.PENDIENTE_COBRO].includes(
        venta.estado,
      ),
    );
  }

  async findAllGeneral(
    sucursalId: string,
    empleadoId?: string,
  ): Promise<
    {
      comprobante: Comprobante;
      vendedor: { id: string; nombreCompleto: string; email: string } | null;
      cajero: { id: string; nombreCompleto: string; email: string } | null;
      listaPrecio: ListaPrecio | null;
      pagos: PagoPos[];
      fiscales: Comprobante[];
      notasCredito: Comprobante[];
      margen: {
        costo_total: number;
        ganancia_total: number;
        margen_porcentaje: number;
        iva_estimado: number;
      };
    }[]
  > {
    const comprobantes = await this.comprobantesService.findAll(sucursalId);
    const principales = comprobantes.filter((comprobante) =>
      [TipoComprobante.VENTA, TipoComprobante.COTIZACION].includes(comprobante.tipo),
    );
    const visibles = empleadoId
      ? principales.filter(
          (comprobante) =>
            comprobante.empleado_vendedor_id === empleadoId ||
            comprobante.empleado_cajero_id === empleadoId,
        )
      : principales;

    const empleadoIds = Array.from(
      new Set(
        visibles
          .flatMap((comprobante) => [
            comprobante.empleado_vendedor_id,
            comprobante.empleado_cajero_id,
          ])
          .filter(Boolean) as string[],
      ),
    );
    const empleados = empleadoIds.length
      ? await this.empleadoRepo.find({ where: { id: In(empleadoIds) } })
      : [];
    const empleadosById = new Map(empleados.map((empleado) => [empleado.id, empleado]));

    const productoIds = Array.from(
      new Set(
        visibles
          .flatMap((comprobante) => comprobante.items ?? [])
          .map((item) => item.producto_id)
          .filter(Boolean) as string[],
      ),
    );
    const productos = productoIds.length
      ? await this.productoRepo.find({ where: { id: In(productoIds) } })
      : [];
    const productosById = new Map(productos.map((producto) => [producto.id, producto]));

    const listasById = new Map<string, ListaPrecio | null>();
    await Promise.all(
      Array.from(
        new Set(visibles.map((comprobante) => comprobante.lista_precio_id).filter(Boolean) as string[]),
      ).map(async (listaId) => {
        try {
          listasById.set(listaId, await this.listaPrecioService.findOne(listaId));
        } catch {
          listasById.set(listaId, null);
        }
      }),
    );

    const pagosPorComprobante = await Promise.all(
      visibles.map((comprobante) => this.pagosPosService.findByComprobante(comprobante.id)),
    );

    return visibles.map((comprobante, index) => {
      const listaPrecio = comprobante.lista_precio_id
        ? listasById.get(comprobante.lista_precio_id) ?? null
        : null;

      return {
        comprobante,
        vendedor: this.empleadoResumen(
          comprobante.empleado_vendedor_id
            ? empleadosById.get(comprobante.empleado_vendedor_id)
            : null,
        ),
        cajero: this.empleadoResumen(
          comprobante.empleado_cajero_id
            ? empleadosById.get(comprobante.empleado_cajero_id)
            : null,
        ),
        listaPrecio,
        pagos: pagosPorComprobante[index],
        fiscales: comprobantes.filter(
          (item) =>
            item.comprobante_origen_id === comprobante.id &&
            [
              TipoComprobante.TICKET,
              TipoComprobante.FACTURA_A,
              TipoComprobante.FACTURA_B,
              TipoComprobante.FACTURA_C,
            ].includes(item.tipo),
        ),
        notasCredito: comprobantes.filter(
          (item) =>
            item.tipo === TipoComprobante.NOTA_CREDITO &&
            (item.comprobante_origen_id === comprobante.id ||
              comprobantes.some(
                (fiscal) =>
                  fiscal.comprobante_origen_id === comprobante.id &&
                  fiscal.id === item.comprobante_origen_id,
              )),
        ),
        margen: this.calcularMargen(comprobante, productosById, listaPrecio),
      };
    });
  }

  async ventasPorCaja(
    cajaId: string,
    sucursalId: string,
  ): Promise<
    {
      venta: Comprobante;
      pagos: PagoPos[];
      vendedor: { id: string; nombreCompleto: string; email: string } | null;
      cajero: { id: string; nombreCompleto: string; email: string } | null;
    }[]
  > {
    // 1. Tomamos solamente ventas POS de la sucursal activa y de la caja indicada.
    const ventas = (await this.findAll(sucursalId)).filter(
      (venta) => venta.caja_id === cajaId,
    );

    // 2. Traemos pagos y empleados relacionados para que el frontend no tenga que unir datos.
    const pagosPorVenta = await Promise.all(
      ventas.map((venta) => this.pagosPosService.findByComprobante(venta.id)),
    );
    const empleadoIds = Array.from(
      new Set(
        ventas
          .flatMap((venta) => [
            venta.empleado_vendedor_id,
            venta.empleado_cajero_id,
          ])
          .filter(Boolean) as string[],
      ),
    );
    const empleados = empleadoIds.length
      ? await this.empleadoRepo.find({ where: { id: In(empleadoIds) } })
      : [];
    const empleadosById = new Map(empleados.map((empleado) => [empleado.id, empleado]));

    // 3. Armamos una respuesta lista para mostrar: venta, pagos y responsables.
    return ventas.map((venta, index) => ({
      venta,
      pagos: pagosPorVenta[index],
      vendedor: this.empleadoResumen(
        venta.empleado_vendedor_id
          ? empleadosById.get(venta.empleado_vendedor_id)
          : null,
      ),
      cajero: this.empleadoResumen(
        venta.empleado_cajero_id ? empleadosById.get(venta.empleado_cajero_id) : null,
      ),
    }));
  }

  async findOne(
    id: string,
    sucursalId: string,
    empleadoId?: string,
  ): Promise<Comprobante> {
    const venta = await this.validarVenta(id, sucursalId);
    if (
      empleadoId &&
      venta.empleado_vendedor_id !== empleadoId &&
      venta.empleado_cajero_id !== empleadoId
    ) {
      throw new BadRequestException('La venta no pertenece al usuario actual');
    }
    return venta;
  }

  private async validarVenta(
    id: string,
    sucursalId: string,
  ): Promise<Comprobante> {
    const comprobante = await this.comprobantesService.findOne(id, sucursalId);
    if (comprobante.tipo !== TipoComprobante.VENTA) {
      throw new BadRequestException('El comprobante no es una venta POS');
    }
    return comprobante;
  }

  private empleadoResumen(empleado?: Empleado | null) {
    if (!empleado) return null;
    return {
      id: empleado.id,
      nombreCompleto: empleado.nombreCompleto,
      email: empleado.email,
    };
  }

  private calcularMargen(
    comprobante: Comprobante,
    productosById: Map<string, Producto>,
    listaPrecio?: ListaPrecio | null,
  ) {
    let costoTotal = 0;
    let ivaEstimado = 0;

    for (const item of comprobante.items ?? []) {
      const cantidad = Number(item.cantidad ?? 0);
      const precioUnitario = Number(item.precio_unitario ?? 0);
      const producto = item.producto_id ? productosById.get(item.producto_id) : null;
      costoTotal += cantidad * Number(producto?.precio_costo ?? 0);

      const ivaPorcentaje = Number(listaPrecio?.porcentaje_iva ?? 0);
      if (ivaPorcentaje > 0 && ['AGREGAR_IVA', 'IVA_INCLUIDO'].includes(listaPrecio?.modo_iva ?? '')) {
        const neto = precioUnitario / (1 + ivaPorcentaje / 100);
        ivaEstimado += (precioUnitario - neto) * cantidad;
      }
    }

    const total = Number(comprobante.total ?? 0);
    const gananciaTotal = total - costoTotal;
    const margenPorcentaje = total > 0 ? (gananciaTotal / total) * 100 : 0;

    return {
      costo_total: this.round(costoTotal),
      ganancia_total: this.round(gananciaTotal),
      margen_porcentaje: this.round(margenPorcentaje),
      iva_estimado: this.round(ivaEstimado),
    };
  }

  private round(value: number): number {
    return Number(Number(value).toFixed(2));
  }

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
      despues: {
        tipo: comprobante.tipo,
        numero: comprobante.numero,
        venta_id: venta.id,
      },
    });
    return comprobante;
  }
}
