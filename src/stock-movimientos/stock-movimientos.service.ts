import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Comprobante } from 'src/comprobantes/entities/comprobante.entity';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { ConfiguracionEmailService } from 'src/configuracion/configuracion-email.service';
import { ComprobanteItem } from 'src/comprobantes/entities/comprobante-item.entity';
import { Producto } from 'src/producto/entities/producto.entity';
import { UnidadVenta } from 'src/producto/entities/producto.entity';
import { Stock } from 'src/stock/entities/stock.entity';
import { EntityManager, IsNull, Repository } from 'typeorm';
import {
  AjusteManualStockDto,
  OperacionAjusteStock,
} from './dto/create-stock-movimiento.dto';
import {
  OrigenMovimientoStock,
  StockMovimiento,
  TipoMovimientoStock,
} from './entities/stock-movimiento.entity';

@Injectable()
export class StockMovimientosService {
  private readonly logger = new Logger(StockMovimientosService.name);

  constructor(
    @InjectRepository(StockMovimiento)
    private readonly movimientoRepo: Repository<StockMovimiento>,
    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    private readonly auditoriaService: AuditoriaService,
    private readonly emailService: ConfiguracionEmailService,
  ) {}

  async ajusteManual(
    sucursalId: string,
    empleadoId: string,
    dto: AjusteManualStockDto,
  ): Promise<StockMovimiento> {
    // 1. Validamos producto y cantidad antes de tocar stock.
    const producto = await this.validarProducto(dto.producto_id);
    this.validarCantidadProducto(producto, Number(dto.cantidad));

    // 2. Calculamos la cantidad final segun la operacion pedida.
    const stock = await this.buscarOCrearStock(
      dto.producto_id,
      dto.variante_id ?? null,
      sucursalId,
    );
    const cantidadAnterior = Number(stock.cantidad ?? 0);
    const cantidad = Number(dto.cantidad);
    let cantidadNueva = cantidadAnterior;

    if (dto.operacion === OperacionAjusteStock.AUMENTAR) {
      cantidadNueva = cantidadAnterior + cantidad;
    }
    if (dto.operacion === OperacionAjusteStock.RESTAR) {
      cantidadNueva = cantidadAnterior - cantidad;
    }
    if (dto.operacion === OperacionAjusteStock.AJUSTAR) {
      cantidadNueva = cantidad;
    }
    if (cantidadNueva < 0) {
      throw new BadRequestException('El stock no puede quedar negativo');
    }

    // 3. Guardamos stock y movimiento de auditoria.
    stock.cantidad = cantidadNueva;
    await this.stockRepo.save(stock);

    const origen =
      dto.tipo === TipoMovimientoStock.SALIDA
        ? OrigenMovimientoStock.CONSUMO_INTERNO
        : OrigenMovimientoStock.MANUAL;

    const movimiento = await this.movimientoRepo.save(
      this.movimientoRepo.create({
        tipo: dto.tipo ?? TipoMovimientoStock.AJUSTE,
        origen,
        producto_id: dto.producto_id,
        variante_id: dto.variante_id ?? null,
        sucursal_id: sucursalId,
        cantidad,
        cantidad_anterior: cantidadAnterior,
        cantidad_nueva: cantidadNueva,
        empleado_id: empleadoId,
        descripcion: dto.descripcion ?? 'Ajuste manual de stock',
      }),
    );
    await this.auditoriaService.registrar({
      modulo: 'stock',
      accion:
        origen === OrigenMovimientoStock.CONSUMO_INTERNO
          ? 'CONSUMO_INTERNO'
          : 'AJUSTE_STOCK',
      entidad: 'stock_movimiento',
      entidad_id: movimiento.id,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      descripcion: movimiento.descripcion,
      antes: { cantidad: cantidadAnterior },
      despues: {
        producto_id: dto.producto_id,
        variante_id: dto.variante_id ?? null,
        cantidad,
        cantidad_nueva: cantidadNueva,
        tipo: movimiento.tipo,
        origen,
      },
    });
    return movimiento;
  }

  async descontarPorComprobante(
    comprobante: Comprobante,
    empleadoId: string,
    manager?: EntityManager,
  ): Promise<StockMovimiento[]> {
    const movimientoRepo = manager
      ? manager.getRepository(StockMovimiento)
      : this.movimientoRepo;
    const stockRepo = manager ? manager.getRepository(Stock) : this.stockRepo;
    const productoRepo = manager ? manager.getRepository(Producto) : this.productoRepo;

    // 1. Evitamos descontar dos veces el mismo comprobante.
    const yaDescontado = await movimientoRepo.findOne({
      where: {
        comprobante_id: comprobante.id,
        origen: OrigenMovimientoStock.COMPROBANTE,
        tipo: TipoMovimientoStock.SALIDA,
      },
    });
    if (yaDescontado) return [];

    const movimientos: StockMovimiento[] = [];

    for (const item of comprobante.items ?? []) {
      if (!item.producto_id) continue;

      // 2. Validamos producto y regla de unidad antes de descontar.
      const producto = await productoRepo.findOne({ where: { id: item.producto_id } });
      if (!producto) throw new NotFoundException('Producto no encontrado para descontar stock');
      this.validarCantidadProducto(producto, Number(item.cantidad));

      // 3. Buscamos stock de la sucursal. Si no existe, no podemos vender.
      const stock = await stockRepo.findOne({
        where: {
          producto_id: item.producto_id,
          variante_id: item.variante_id ?? IsNull(),
          sucursal_id: comprobante.sucursal_id,
        },
      });
      if (!stock) {
        throw new BadRequestException(`No hay stock configurado para "${item.descripcion}"`);
      }

      const cantidadAnterior = Number(stock.cantidad ?? 0);
      const cantidad = Number(item.cantidad);
      const cantidadNueva = cantidadAnterior - cantidad;
      if (cantidadNueva < 0) {
        throw new BadRequestException(`Stock insuficiente para "${item.descripcion}"`);
      }

      // 4. Actualizamos stock y guardamos movimiento auditable.
      stock.cantidad = cantidadNueva;
      await stockRepo.save(stock);

      const movimiento = movimientoRepo.create({
        tipo: TipoMovimientoStock.SALIDA,
        origen: OrigenMovimientoStock.COMPROBANTE,
        producto_id: item.producto_id,
        variante_id: item.variante_id ?? null,
        sucursal_id: comprobante.sucursal_id,
        cantidad,
        cantidad_anterior: cantidadAnterior,
        cantidad_nueva: cantidadNueva,
        comprobante_id: comprobante.id,
        empleado_id: empleadoId,
        descripcion: `Salida por comprobante ${comprobante.numero}`,
      });
      movimientos.push(await movimientoRepo.save(movimiento));

      // Alerta de stock mínimo en background — no bloquea el cobro
      void this.enviarAlertaStockMinimo(stock, producto.nombre, comprobante.sucursal_id);
    }

    return movimientos;
  }

  async registrarSalidaPorDespacho(
    sucursalId: string,
    empleadoId: string,
    params: {
      despacho_id: string;
      comprobante_id: string;
      item: ComprobanteItem;
      cantidad: number;
    },
    manager?: EntityManager,
  ): Promise<StockMovimiento | null> {
    if (!params.item.producto_id || Number(params.cantidad) === 0) return null;

    const movimientoRepo = manager
      ? manager.getRepository(StockMovimiento)
      : this.movimientoRepo;
    const stockRepo = manager ? manager.getRepository(Stock) : this.stockRepo;
    const productoRepo = manager ? manager.getRepository(Producto) : this.productoRepo;

    // 1. Validamos producto y cantidad entregada antes de descontar.
    const producto = await productoRepo.findOne({
      where: { id: params.item.producto_id },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado para despacho');
    this.validarCantidadProducto(producto, Number(params.cantidad));

    // 2. Buscamos el stock de la sucursal activa. Despacho no crea stock: debe existir.
    const stock = await stockRepo.findOne({
      where: {
        producto_id: params.item.producto_id,
        variante_id: params.item.variante_id ?? IsNull(),
        sucursal_id: sucursalId,
      },
    });
    if (!stock) {
      throw new BadRequestException(
        `No hay stock configurado para "${params.item.descripcion}"`,
      );
    }

    const cantidadAnterior = Number(stock.cantidad ?? 0);
    const cantidadNueva = cantidadAnterior - Number(params.cantidad);
    if (cantidadNueva < 0) {
      throw new BadRequestException(
        `Stock insuficiente para despachar "${params.item.descripcion}"`,
      );
    }

    // 3. Actualizamos stock y dejamos el movimiento ligado al despacho.
    stock.cantidad = cantidadNueva;
    await stockRepo.save(stock);

    const movimientoDespacho = await movimientoRepo.save(
      movimientoRepo.create({
        tipo: TipoMovimientoStock.DESPACHO,
        origen: OrigenMovimientoStock.DESPACHO,
        producto_id: params.item.producto_id,
        variante_id: params.item.variante_id ?? null,
        sucursal_id: sucursalId,
        cantidad: Number(params.cantidad),
        cantidad_anterior: cantidadAnterior,
        cantidad_nueva: cantidadNueva,
        comprobante_id: params.comprobante_id,
        despacho_id: params.despacho_id,
        empleado_id: empleadoId,
        descripcion: `Salida por despacho de ${params.item.descripcion}`,
      }),
    );

    void this.enviarAlertaStockMinimo(stock, params.item.descripcion, sucursalId);
    return movimientoDespacho;
  }

  async registrarEntradaPorNotaCredito(
    sucursalId: string,
    empleadoId: string,
    params: {
      nota_credito_id: string;
      item: ComprobanteItem;
      cantidad: number;
    },
    manager?: EntityManager,
  ): Promise<StockMovimiento | null> {
    if (!params.item.producto_id || Number(params.cantidad) === 0) return null;

    const movimientoRepo = manager
      ? manager.getRepository(StockMovimiento)
      : this.movimientoRepo;
    const stockRepo = manager ? manager.getRepository(Stock) : this.stockRepo;
    const productoRepo = manager ? manager.getRepository(Producto) : this.productoRepo;

    // 1. Validamos producto y cantidad antes de reingresar mercaderia.
    const producto = await productoRepo.findOne({
      where: { id: params.item.producto_id },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado para devolucion');
    this.validarCantidadProducto(producto, Number(params.cantidad));

    // 2. Si el stock no existe, lo creamos porque una devolucion puede reabrir stock.
    const stock = await this.buscarOCrearStockConRepos(
      params.item.producto_id,
      params.item.variante_id ?? null,
      sucursalId,
      stockRepo,
    );
    const cantidadAnterior = Number(stock.cantidad ?? 0);
    const cantidadNueva = cantidadAnterior + Number(params.cantidad);

    // 3. Guardamos el reingreso con origen NOTA_CREDITO para auditoria.
    stock.cantidad = cantidadNueva;
    await stockRepo.save(stock);

    return movimientoRepo.save(
      movimientoRepo.create({
        tipo: TipoMovimientoStock.DEVOLUCION,
        origen: OrigenMovimientoStock.DEVOLUCION,
        producto_id: params.item.producto_id,
        variante_id: params.item.variante_id ?? null,
        sucursal_id: sucursalId,
        cantidad: Number(params.cantidad),
        cantidad_anterior: cantidadAnterior,
        cantidad_nueva: cantidadNueva,
        comprobante_id: params.nota_credito_id,
        empleado_id: empleadoId,
        descripcion: `Reingreso por nota de credito de ${params.item.descripcion}`,
      }),
    );
  }

  async findAll(sucursalId: string): Promise<StockMovimiento[]> {
    return this.movimientoRepo.find({
      where: { sucursal_id: sucursalId },
      order: { created_at: 'DESC' },
    });
  }

  async findByProducto(
    sucursalId: string,
    productoId: string,
  ): Promise<StockMovimiento[]> {
    return this.movimientoRepo.find({
      where: { sucursal_id: sucursalId, producto_id: productoId },
      order: { created_at: 'DESC' },
    });
  }

  private async buscarOCrearStock(
    productoId: string,
    varianteId: string | null,
    sucursalId: string,
  ): Promise<Stock> {
    let stock = await this.stockRepo.findOne({
      where: {
        producto_id: productoId,
        variante_id: varianteId ?? IsNull(),
        sucursal_id: sucursalId,
      },
    });
    if (stock) return stock;

    stock = this.stockRepo.create({
      producto_id: productoId,
      variante_id: varianteId,
      sucursal_id: sucursalId,
      cantidad: 0,
      cantidad_minima: 0,
    } as Partial<Stock>);
    return this.stockRepo.save(stock);
  }

  private async buscarOCrearStockConRepos(
    productoId: string,
    varianteId: string | null,
    sucursalId: string,
    stockRepo: Repository<Stock>,
  ): Promise<Stock> {
    let stock = await stockRepo.findOne({
      where: {
        producto_id: productoId,
        variante_id: varianteId ?? IsNull(),
        sucursal_id: sucursalId,
      },
    });
    if (stock) return stock;

    stock = stockRepo.create({
      producto_id: productoId,
      variante_id: varianteId,
      sucursal_id: sucursalId,
      cantidad: 0,
      cantidad_minima: 0,
    } as Partial<Stock>);
    return stockRepo.save(stock);
  }

  private async validarProducto(productoId: string): Promise<Producto> {
    const producto = await this.productoRepo.findOne({ where: { id: productoId } });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return producto;
  }

  private validarCantidadProducto(producto: Producto, cantidad: number): void {
    if (!Number.isFinite(cantidad) || cantidad < 0) {
      throw new BadRequestException('La cantidad debe ser un numero no negativo');
    }
    if (
      producto.unidad_venta === UnidadVenta.UNIDAD &&
      !producto.es_fraccionable &&
      !Number.isInteger(cantidad)
    ) {
      throw new BadRequestException(
        'La cantidad debe ser entera para productos vendidos por unidad',
      );
    }
  }

  // Dispara alerta si el stock quedó por debajo del mínimo configurado.
  // Se llama de forma asíncrona sin await para no bloquear el flujo de venta.
  private async enviarAlertaStockMinimo(
    stock: Stock,
    productoNombre: string,
    sucursalId: string,
  ): Promise<void> {
    try {
      const minimo = Number(stock.cantidad_minima ?? 0);
      if (minimo <= 0 || Number(stock.cantidad) > minimo) return;

      const asunto = `⚠️ Stock mínimo alcanzado: ${productoNombre}`;
      const cantidad = Number(stock.cantidad).toFixed(2);
      const texto = [
        `ALERTA DE STOCK MÍNIMO`,
        ``,
        `Producto: ${productoNombre}`,
        `Stock actual: ${cantidad}`,
        `Stock mínimo configurado: ${minimo}`,
        `Sucursal ID: ${sucursalId}`,
        ``,
        `Se recomienda reabastecer este producto a la brevedad.`,
        ``,
        `-- Sistema ERP`,
      ].join('\n');

      // Obtener el email de la sucursal para enviar la alerta al remitente configurado
      const emailConfig = await (this.emailService as any).emailRepo.findOne({
        where: { sucursal_id: sucursalId },
      }) as { email_remitente?: string; activo?: boolean } | null;
      if (!emailConfig?.activo || !emailConfig.email_remitente) return;

      await this.emailService.enviarCorreoSucursal(sucursalId, {
        to: emailConfig.email_remitente,
        subject: asunto,
        text: texto,
      });
    } catch (error) {
      // La alerta es secundaria — un fallo no debe interrumpir la venta
      this.logger.warn(`No se pudo enviar alerta de stock para sucursal ${sucursalId}: ${(error as Error).message}`);
    }
  }
}
