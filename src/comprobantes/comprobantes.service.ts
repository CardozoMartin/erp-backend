import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfiguracionService } from 'src/configuracion/configuracion.service';
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
    private readonly dataSource: DataSource,
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
      return this.findOne(comprobante.id, sucursalId);
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
  ): Promise<Comprobante> {
    const comprobante = await this.findOne(id, sucursalId);
    if (comprobante.estado !== EstadoComprobante.BORRADOR) {
      throw new BadRequestException(
        'Solo se pueden modificar comprobantes en borrador',
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
    return this.findOne(id, sucursalId);
  }

  async cambiarEstado(
    id: string,
    sucursalId: string,
    dto: CambiarEstadoComprobanteDto,
  ): Promise<Comprobante> {
    // 1. Por ahora solo cambiamos estado. Cuando creemos flujos, validamos transiciones aca.
    const comprobante = await this.findOne(id, sucursalId);
    comprobante.estado = dto.estado;
    comprobante.observaciones = dto.observaciones ?? comprobante.observaciones;
    return this.comprobanteRepo.save(comprobante);
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
  ): Promise<Partial<ComprobanteItem>[]> {
    const itemsCalculados: Partial<ComprobanteItem>[] = [];

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
      itemsCalculados.push(
        this.calcularItem({
          ...item,
          descripcion: item.descripcion || producto.nombre,
        }),
      );
    }

    return itemsCalculados;
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
}
