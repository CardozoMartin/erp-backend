import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfiguracionService } from 'src/configuracion/configuracion.service';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { ListaPrecioService } from 'src/lista-precio/lista-precio.service';
import { ListaPrecio } from 'src/lista-precio/entities/lista-precio.entity';
import { ProductoSucursal } from 'src/producto/entities/producto-sucursal-entity';
import { Producto } from 'src/producto/entities/producto.entity';
import { Stock } from 'src/stock/entities/stock.entity';
import { DataSource, IsNull, Repository } from 'typeorm';
import {
  CambiarEstadoComprobanteDto,
  CreateComprobanteDto,
  CreateComprobanteItemDto,
} from './dto/create-comprobante.dto';
import { UpdateComprobanteDto } from './dto/update-comprobante.dto';
import {
  Comprobante,
  EstadoComprobante,
  TipoComprobante,
} from './entities/comprobante.entity';
import { ComprobanteItem } from './entities/comprobante-item.entity';
import { NumeradorComprobante } from './entities/numerador-comprobante.entity';

@Injectable()
export class ComprobantesService {
  constructor(
    @InjectRepository(Comprobante)
    private readonly comprobanteRepo: Repository<Comprobante>,
    @InjectRepository(ComprobanteItem)
    private readonly itemRepo: Repository<ComprobanteItem>,
    @InjectRepository(NumeradorComprobante)
    private readonly numeradorRepo: Repository<NumeradorComprobante>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,
    @InjectRepository(ProductoSucursal)
    private readonly productoSucursalRepo: Repository<ProductoSucursal>,
    private readonly configuracionService: ConfiguracionService,
    private readonly listaPrecioService: ListaPrecioService,
    private readonly dataSource: DataSource,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async create(
    sucursalId: string,
    empleadoId: string,
    dto: CreateComprobanteDto,
  ): Promise<Comprobante> {
    if (!dto.items?.length) {
      throw new BadRequestException('El comprobante debe tener al menos un item');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Generamos numero dentro de la transaccion para no repetir correlativos.
      const numeracion = await this.generarNumero(
        sucursalId,
        dto.tipo,
        queryRunner.manager.getRepository(NumeradorComprobante),
      );

      // 2. Validamos productos/stock y calculamos cada item congelando precio, descuento y subtotal.
      const itemsCalculados = await this.calcularItemsValidados(
        sucursalId,
        dto.tipo,
        dto.items,
        dto.omitir_validacion_stock ?? false,
        dto.lista_precio_id,
      );

      // 3. Calculamos totales generales del comprobante.
      const subtotal = this.round(
        itemsCalculados.reduce((sum, item) => sum + Number(item.subtotal), 0),
      );
      const descuentoPorcentaje = Number(dto.descuento_global_porcentaje ?? 0);
      const descuentoPorcentajeMonto = this.round(
        subtotal * (descuentoPorcentaje / 100),
      );
      const descuentoGlobalMonto = Number(dto.descuento_global_monto ?? 0);
      const descuentoTotal = this.round(
        itemsCalculados.reduce(
          (sum, item) => sum + Number(item.descuento_monto ?? 0),
          0,
        ) +
          descuentoPorcentajeMonto +
          descuentoGlobalMonto,
      );
      const recargoTotal = Number(dto.recargo_total ?? 0);
      const total = this.round(subtotal - descuentoTotal + recargoTotal);

      // 4. Creamos la cabecera con estado inicial coherente al tipo.
      const comprobante = this.comprobanteRepo.create({
        tipo: dto.tipo,
        estado: dto.estado ?? this.estadoInicial(dto.tipo),
        numero: numeracion.numero,
        numero_secuencial: numeracion.secuencial,
        punto_venta: dto.punto_venta ?? this.puntoVentaDesdeTipo(dto.tipo, numeracion.prefijo),
        codigo_fiscal: dto.codigo_fiscal ?? null,
        cae: dto.cae ?? null,
        cae_vencimiento: dto.cae_vencimiento ? new Date(dto.cae_vencimiento) : null,
        sucursal_id: sucursalId,
        caja_id: dto.caja_id ?? null,
        cliente_id: dto.cliente_id ?? null,
        empleado_vendedor_id: dto.empleado_vendedor_id ?? empleadoId,
        empleado_cajero_id: dto.empleado_cajero_id ?? null,
        empleado_despachador_id: dto.empleado_despachador_id ?? null,
        comprobante_origen_id: dto.comprobante_origen_id ?? null,
        lista_precio_id: dto.lista_precio_id ?? null,
        subtotal,
        descuento_global_porcentaje: descuentoPorcentaje,
        descuento_global_monto: descuentoGlobalMonto,
        descuento_total: descuentoTotal,
        recargo_total: recargoTotal,
        total,
        observaciones: dto.observaciones ?? null,
        fecha_vencimiento: dto.fecha_vencimiento
          ? new Date(dto.fecha_vencimiento)
          : await this.fechaVencimientoDefault(sucursalId, dto.tipo),
      });
      await queryRunner.manager.save(comprobante);

      // 5. Guardamos los items relacionados al comprobante creado.
      const items = itemsCalculados.map((item) =>
        this.itemRepo.create({
          ...item,
          comprobante_id: comprobante.id,
        }),
      );
      await queryRunner.manager.save(items);

      await queryRunner.commitTransaction();
      const creado = await this.findOne(comprobante.id, sucursalId);
      await this.auditoriaService.registrar({
        modulo: 'comprobantes',
        accion: 'CREAR_COMPROBANTE',
        entidad: 'comprobante',
        entidad_id: creado.id,
        empleado_id: empleadoId,
        sucursal_id: sucursalId,
        descripcion: `${creado.tipo} creado ${creado.numero}`,
        despues: this.snapshotComprobante(creado),
        metadata: {
          tipo: creado.tipo,
          estado: creado.estado,
          numero: creado.numero,
          total: Number(creado.total ?? 0),
          cantidad_items: creado.items?.length ?? 0,
          cliente_id: creado.cliente_id,
          vendedor_id: creado.empleado_vendedor_id,
        },
      });
      return creado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(sucursalId: string, tipo?: TipoComprobante) {
    return this.comprobanteRepo.find({
      where: tipo ? { sucursal_id: sucursalId, tipo } : { sucursal_id: sucursalId },
      relations: ['items', 'comprobanteOrigen'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, sucursalId?: string): Promise<Comprobante> {
    const comprobante = await this.comprobanteRepo.findOne({
      where: sucursalId ? { id, sucursal_id: sucursalId } : { id },
      relations: ['items', 'comprobanteOrigen'],
    });
    if (!comprobante) throw new NotFoundException('Comprobante no encontrado');
    return comprobante;
  }

  async update(
    id: string,
    sucursalId: string,
    dto: UpdateComprobanteDto,
    empleadoId?: string | null,
  ): Promise<Comprobante> {
    const comprobante = await this.findOne(id, sucursalId);
    const antes = this.snapshotComprobante(comprobante);
    if (
      ![EstadoComprobante.BORRADOR, EstadoComprobante.PENDIENTE_COBRO].includes(
        comprobante.estado,
      )
    ) {
      throw new BadRequestException(
        'Solo se pueden modificar comprobantes en borrador o pendientes de cobro',
      );
    }

    // 1. Actualizamos datos simples de cabecera. Los items se recalculan si vienen en el DTO.
    Object.assign(comprobante, {
      caja_id: dto.caja_id ?? comprobante.caja_id,
      cliente_id: dto.cliente_id ?? comprobante.cliente_id,
      empleado_cajero_id: dto.empleado_cajero_id ?? comprobante.empleado_cajero_id,
      empleado_despachador_id:
        dto.empleado_despachador_id ?? comprobante.empleado_despachador_id,
      lista_precio_id: dto.lista_precio_id ?? comprobante.lista_precio_id,
      observaciones: dto.observaciones ?? comprobante.observaciones,
      fecha_vencimiento: dto.fecha_vencimiento
        ? new Date(dto.fecha_vencimiento)
        : comprobante.fecha_vencimiento,
    });

    if (dto.items?.length) {
      const itemsCalculados = await this.calcularItemsValidados(
        sucursalId,
        comprobante.tipo,
        dto.items,
        dto.omitir_validacion_stock ?? false,
        dto.lista_precio_id ?? comprobante.lista_precio_id,
      );
      comprobante.subtotal = this.round(
        itemsCalculados.reduce((sum, item) => sum + Number(item.subtotal), 0),
      );
      comprobante.descuento_global_porcentaje = Number(
        dto.descuento_global_porcentaje ?? comprobante.descuento_global_porcentaje,
      );
      comprobante.descuento_global_monto = Number(
        dto.descuento_global_monto ?? comprobante.descuento_global_monto,
      );
      comprobante.recargo_total = Number(dto.recargo_total ?? comprobante.recargo_total);
      const descuentoPorcentajeMonto = this.round(
        comprobante.subtotal *
          (Number(comprobante.descuento_global_porcentaje ?? 0) / 100),
      );
      comprobante.descuento_total = this.round(
        itemsCalculados.reduce(
          (sum, item) => sum + Number(item.descuento_monto ?? 0),
          0,
        ) +
          descuentoPorcentajeMonto +
          Number(comprobante.descuento_global_monto ?? 0),
      );
      comprobante.total = this.round(
        comprobante.subtotal - comprobante.descuento_total + comprobante.recargo_total,
      );

      await this.itemRepo.delete({ comprobante_id: comprobante.id });
      await this.itemRepo.save(
        itemsCalculados.map((item) =>
          this.itemRepo.create({ ...item, comprobante_id: comprobante.id }),
        ),
      );
    }

    await this.comprobanteRepo.save(comprobante);
    const actualizado = await this.findOne(id, sucursalId);
    const despues = this.snapshotComprobante(actualizado);
    await this.auditoriaService.registrar({
      modulo: 'comprobantes',
      accion: 'ACTUALIZAR_COMPROBANTE',
      entidad: 'comprobante',
      entidad_id: id,
      empleado_id: empleadoId ?? null,
      sucursal_id: sucursalId,
      descripcion: `Comprobante actualizado ${actualizado.numero}`,
      antes,
      despues,
      metadata: {
        campos_recibidos: Object.keys(dto),
        items: this.diffItems(antes.items, despues.items),
        total_anterior: antes.total,
        total_nuevo: despues.total,
      },
    });
    return actualizado;
  }

  async cambiarEstado(
    id: string,
    sucursalId: string,
    dto: CambiarEstadoComprobanteDto,
    empleadoId?: string | null,
  ): Promise<Comprobante> {
    // 1. Por ahora solo cambiamos estado. Cuando creemos flujos, validamos transiciones aca.
    const comprobante = await this.findOne(id, sucursalId);
    const antes = this.snapshotComprobante(comprobante);
    comprobante.estado = dto.estado;
    comprobante.observaciones = dto.observaciones ?? comprobante.observaciones;
    await this.comprobanteRepo.save(comprobante);
    const actualizado = await this.findOne(id, sucursalId);
    await this.auditoriaService.registrar({
      modulo: 'comprobantes',
      accion: 'CAMBIAR_ESTADO_COMPROBANTE',
      entidad: 'comprobante',
      entidad_id: id,
      empleado_id: empleadoId ?? null,
      sucursal_id: sucursalId,
      descripcion: `Estado de ${actualizado.numero} cambiado de ${antes.estado} a ${actualizado.estado}`,
      antes,
      despues: this.snapshotComprobante(actualizado),
      metadata: {
        estado_anterior: antes.estado,
        estado_nuevo: actualizado.estado,
        observaciones: dto.observaciones ?? null,
      },
    });
    return actualizado;
  }

  async verNumeradores(sucursalId: string): Promise<NumeradorComprobante[]> {
    return this.numeradorRepo.find({
      where: { sucursal_id: sucursalId },
      order: { tipo: 'ASC' },
    });
  }

  private async generarNumero(
    sucursalId: string,
    tipo: TipoComprobante,
    repo: Repository<NumeradorComprobante>,
  ): Promise<{ numero: string; secuencial: number; prefijo: string }> {
    // 1. Buscamos el numerador de esa sucursal y tipo de comprobante.
    let numerador = await repo.findOne({
      where: { sucursal_id: sucursalId, tipo },
      lock: { mode: 'pessimistic_write' },
    });

    // 2. Si no existe, lo creamos con el prefijo que corresponde.
    if (!numerador) {
      numerador = repo.create({
        sucursal_id: sucursalId,
        tipo,
        ultimo_numero: 0,
        prefijo: await this.prefijoPorTipo(sucursalId, tipo),
        longitud: 6,
      });
    }

    // 3. Incrementamos y guardamos antes de devolver el numero armado.
    numerador.ultimo_numero = Number(numerador.ultimo_numero) + 1;
    await repo.save(numerador);

    return {
      secuencial: numerador.ultimo_numero,
      numero: this.formatearNumero(tipo, numerador),
      prefijo: numerador.prefijo,
    };
  }

  private async prefijoPorTipo(
    sucursalId: string,
    tipo: TipoComprobante,
  ): Promise<string> {
    const config = await this.configuracionService.crearPorDefecto(sucursalId);

    if (tipo === TipoComprobante.COTIZACION) return config.prefijo_cotizacion;
    if (tipo === TipoComprobante.TICKET) return config.prefijo_ticket;
    if (tipo === TipoComprobante.REMITO) return config.prefijo_remito;
    if (tipo === TipoComprobante.NOTA_CREDITO) return config.prefijo_nota_credito;
    if (
      tipo === TipoComprobante.FACTURA_A ||
      tipo === TipoComprobante.FACTURA_B ||
      tipo === TipoComprobante.FACTURA_C
    ) {
      return config.punto_venta_arca ?? '0001';
    }

    return 'VTA';
  }

  private formatearNumero(
    tipo: TipoComprobante,
    numerador: NumeradorComprobante,
  ): string {
    const correlativo = String(numerador.ultimo_numero).padStart(
      numerador.longitud,
      '0',
    );

    if (tipo === TipoComprobante.FACTURA_A) return `A${numerador.prefijo}-${correlativo}`;
    if (tipo === TipoComprobante.FACTURA_B) return `B${numerador.prefijo}-${correlativo}`;
    if (tipo === TipoComprobante.FACTURA_C) return `C${numerador.prefijo}-${correlativo}`;

    return `${numerador.prefijo}-${correlativo}`;
  }

  private calcularItem(item: CreateComprobanteItemDto): Partial<ComprobanteItem> {
    const cantidad = Number(item.cantidad);
    const precioUnitario = Number(item.precio_unitario);
    const bruto = this.round(cantidad * precioUnitario);
    const descuentoPorcentaje = Number(item.descuento_porcentaje ?? 0);
    const descuentoPorcentajeMonto = this.round(bruto * (descuentoPorcentaje / 100));
    const descuentoMonto = this.round(
      descuentoPorcentajeMonto + Number(item.descuento_monto ?? 0),
    );
    const recargoMonto = Number(item.recargo_monto ?? 0);

    return {
      producto_id: item.producto_id ?? null,
      variante_id: item.variante_id ?? null,
      comprobante_item_origen_id: item.comprobante_item_origen_id ?? null,
      descripcion: item.descripcion,
      cantidad,
      precio_unitario: precioUnitario,
      descuento_porcentaje: descuentoPorcentaje,
      descuento_monto: descuentoMonto,
      recargo_monto: recargoMonto,
      subtotal: this.round(bruto - descuentoMonto + recargoMonto),
    };
  }

  private async calcularItemsValidados(
    sucursalId: string,
    tipo: TipoComprobante,
    items: CreateComprobanteItemDto[],
    omitirValidacionStock = false,
    listaPrecioId?: string | null,
  ): Promise<Partial<ComprobanteItem>[]> {
    const itemsCalculados: Partial<ComprobanteItem>[] = [];
    const listaPrecio = await this.obtenerListaPrecioActiva(
      sucursalId,
      listaPrecioId,
    );

    for (const item of items) {
      // 1. Si el item no viene de un producto real, lo dejamos pasar como concepto manual.
      if (!item.producto_id) {
        itemsCalculados.push(this.calcularItem(item));
        continue;
      }

      // 2. Validamos que el producto exista y pueda venderse por POS.
      const producto = await this.productoRepo.findOne({
        where:
          tipo === TipoComprobante.NOTA_CREDITO
            ? { id: item.producto_id }
            : { id: item.producto_id, activo: true, activo_pos: true },
      });
      if (!producto) {
        throw new BadRequestException(
          `El producto ${item.producto_id} no existe o no esta activo para POS`,
        );
      }

      // 3. Validamos que el producto este habilitado para la sucursal activa.
      if (tipo !== TipoComprobante.NOTA_CREDITO) {
        const productoSucursal = await this.productoSucursalRepo.findOne({
          where: {
            producto_id: item.producto_id,
            sucursal_id: sucursalId,
            activo: true,
          },
        });
        if (!productoSucursal) {
          throw new BadRequestException(
            `El producto "${producto.nombre}" no esta habilitado en esta sucursal`,
          );
        }
      }

      // 4. Para cotizaciones no exigimos stock, porque una cotizacion no reserva ni descuenta.
      if (!omitirValidacionStock && this.requiereStockDisponible(tipo)) {
        const stock = await this.stockRepo.findOne({
          where: {
            producto_id: item.producto_id,
            variante_id: item.variante_id ?? IsNull(),
            sucursal_id: sucursalId,
          },
        });
        const cantidadDisponible = Number(stock?.cantidad ?? 0);
        if (cantidadDisponible < Number(item.cantidad)) {
          throw new BadRequestException(
            `Stock insuficiente para "${producto.nombre}". Disponible: ${cantidadDisponible}`,
          );
        }
      }

      // 5. Si el frontend no mando descripcion, usamos el nombre actual del producto.
      const precioUnitario =
        listaPrecio && !item.comprobante_item_origen_id && tipo !== TipoComprobante.NOTA_CREDITO
          ? this.listaPrecioService.calcularPrecio(
              this.precioBaseProducto(producto),
              listaPrecio,
            )
          : Number(item.precio_unitario);

      itemsCalculados.push(
        this.calcularItem({
          ...item,
          precio_unitario: precioUnitario,
          descripcion: item.descripcion || producto.nombre,
        }),
      );
    }

    return itemsCalculados;
  }

  private async obtenerListaPrecioActiva(
    sucursalId: string,
    listaPrecioId?: string | null,
  ): Promise<ListaPrecio | undefined> {
    if (!listaPrecioId) return undefined;
    const listas = await this.listaPrecioService.findAll(sucursalId);
    const lista = listas.find((item) => item.id === listaPrecioId);
    if (!lista) {
      throw new BadRequestException(
        'La lista de precio no existe, esta inactiva o no corresponde a la sucursal',
      );
    }
    return lista;
  }

  private precioBaseProducto(producto: Producto): number {
    const precioVenta = Number(producto.precio_venta ?? 0);
    if (Number.isFinite(precioVenta) && precioVenta > 0) return precioVenta;
    const precioBase = Number(producto.precio_base ?? 0);
    return Number.isFinite(precioBase) ? precioBase : 0;
  }

  private requiereStockDisponible(tipo: TipoComprobante): boolean {
    return [
      TipoComprobante.VENTA,
      TipoComprobante.TICKET,
      TipoComprobante.FACTURA_A,
      TipoComprobante.FACTURA_B,
      TipoComprobante.FACTURA_C,
    ].includes(tipo);
  }

  private estadoInicial(tipo: TipoComprobante): EstadoComprobante {
    if (tipo === TipoComprobante.COTIZACION) return EstadoComprobante.BORRADOR;
    if (tipo === TipoComprobante.REMITO) return EstadoComprobante.PENDIENTE;
    if (tipo === TipoComprobante.NOTA_CREDITO) return EstadoComprobante.EMITIDA;
    if (tipo === TipoComprobante.TICKET) {
      return EstadoComprobante.EMITIDO;
    }
    if (
      tipo === TipoComprobante.FACTURA_A ||
      tipo === TipoComprobante.FACTURA_B ||
      tipo === TipoComprobante.FACTURA_C
    ) {
      return EstadoComprobante.EMITIDA;
    }
    return EstadoComprobante.BORRADOR;
  }

  private puntoVentaDesdeTipo(
    tipo: TipoComprobante,
    prefijo: string,
  ): string | null {
    if (
      tipo === TipoComprobante.FACTURA_A ||
      tipo === TipoComprobante.FACTURA_B ||
      tipo === TipoComprobante.FACTURA_C
    ) {
      return prefijo;
    }
    return null;
  }

  private async fechaVencimientoDefault(
    sucursalId: string,
    tipo: TipoComprobante,
  ): Promise<Date | null> {
    if (tipo !== TipoComprobante.COTIZACION) return null;
    const config = await this.configuracionService.crearPorDefecto(sucursalId);
    const fecha = new Date();
    fecha.setHours(fecha.getHours() + Number(config.cotizacion_vigencia_horas));
    return fecha;
  }

  private round(value: number): number {
    return Number(Number(value).toFixed(2));
  }

  private snapshotComprobante(comprobante: Comprobante) {
    return {
      id: comprobante.id,
      tipo: comprobante.tipo,
      estado: comprobante.estado,
      numero: comprobante.numero,
      numero_secuencial: comprobante.numero_secuencial,
      punto_venta: comprobante.punto_venta,
      codigo_fiscal: comprobante.codigo_fiscal,
      cae: comprobante.cae,
      cae_vencimiento: comprobante.cae_vencimiento,
      sucursal_id: comprobante.sucursal_id,
      caja_id: comprobante.caja_id,
      cliente_id: comprobante.cliente_id,
      empleado_vendedor_id: comprobante.empleado_vendedor_id,
      empleado_cajero_id: comprobante.empleado_cajero_id,
      empleado_despachador_id: comprobante.empleado_despachador_id,
      comprobante_origen_id: comprobante.comprobante_origen_id,
      lista_precio_id: comprobante.lista_precio_id,
      subtotal: Number(comprobante.subtotal ?? 0),
      descuento_global_porcentaje: Number(comprobante.descuento_global_porcentaje ?? 0),
      descuento_global_monto: Number(comprobante.descuento_global_monto ?? 0),
      descuento_total: Number(comprobante.descuento_total ?? 0),
      recargo_total: Number(comprobante.recargo_total ?? 0),
      total: Number(comprobante.total ?? 0),
      observaciones: comprobante.observaciones,
      fecha_vencimiento: comprobante.fecha_vencimiento,
      items: (comprobante.items ?? []).map((item) => ({
        id: item.id,
        producto_id: item.producto_id,
        variante_id: item.variante_id,
        comprobante_item_origen_id: item.comprobante_item_origen_id,
        descripcion: item.descripcion,
        cantidad: Number(item.cantidad ?? 0),
        precio_unitario: Number(item.precio_unitario ?? 0),
        descuento_porcentaje: Number(item.descuento_porcentaje ?? 0),
        descuento_monto: Number(item.descuento_monto ?? 0),
        recargo_monto: Number(item.recargo_monto ?? 0),
        subtotal: Number(item.subtotal ?? 0),
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
            Number(anterior.precio_unitario) !== Number(item.precio_unitario) ||
            Number(anterior.subtotal) !== Number(item.subtotal))
        );
      })
      .map((item) => ({
        antes: anteriores.get(key(item)),
        despues: item,
      }));

    return { agregados, eliminados, modificados };
  }
}
