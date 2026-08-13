import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { ListaPrecioService } from 'src/lista-precio/lista-precio.service';
import { ListaPrecio } from 'src/lista-precio/entities/lista-precio.entity';
import { ProductoSucursal } from 'src/producto/entities/producto-sucursal-entity';
import { Producto } from 'src/producto/entities/producto.entity';
import { Stock } from 'src/stock/entities/stock.entity';
import { Lote } from 'src/lote/entities/lote.entity';
import { CreateComprobanteItemDto } from '../dto/create-comprobante.dto';
import { ComprobanteItem } from '../entities/comprobante-item.entity';
import { TipoComprobante } from '../entities/comprobante.entity';

@Injectable()
export class ComprobanteItemsService {
  constructor(
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,
    @InjectRepository(Lote)
    private readonly loteRepo: Repository<Lote>,
    @InjectRepository(ProductoSucursal)
    private readonly productoSucursalRepo: Repository<ProductoSucursal>,
    private readonly listaPrecioService: ListaPrecioService,
  ) {}

  calcularItem(item: CreateComprobanteItemDto): Partial<ComprobanteItem> {
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

  async calcularItemsValidados(
    sucursalId: string,
    tipo: TipoComprobante,
    items: CreateComprobanteItemDto[],
    omitirValidacionStock = false,
    listaPrecioId?: string | null,
  ): Promise<Partial<ComprobanteItem>[]> {
    const itemsCalculados: Partial<ComprobanteItem>[] = [];
    const listaPrecio = await this.obtenerListaPrecioActiva(sucursalId, listaPrecioId);

    for (const item of items) {
      // 1.- Item sin producto: concepto manual, no requiere validaciones
      if (!item.producto_id) {
        itemsCalculados.push(this.calcularItem(item));
        continue;
      }

      // 2.- Validar que el producto exista y esté activo para POS
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

      // 3.- Validar que el producto esté habilitado en la sucursal
      if (tipo !== TipoComprobante.NOTA_CREDITO) {
        const productoSucursal = await this.productoSucursalRepo.findOne({
          where: { producto_id: item.producto_id, sucursal_id: sucursalId, activo: true },
        });
        if (!productoSucursal) {
          throw new BadRequestException(
            `El producto "${producto.nombre}" no esta habilitado en esta sucursal`,
          );
        }
      }

      // 4.- Validar stock disponible (las cotizaciones no lo requieren)
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

        // 4b.- Si el producto controla vencimiento, validar que haya lotes vigentes suficientes
        if (producto.tiene_vencimiento) {
          await this.validarLotesVigentes(
            item.producto_id,
            item.variante_id ?? null,
            sucursalId,
            Number(item.cantidad),
            producto.nombre,
          );
        }
      }

      // 5.- Calcular precio desde lista de precios si aplica
      const precioUnitario =
        listaPrecio && !item.comprobante_item_origen_id && tipo !== TipoComprobante.NOTA_CREDITO
          ? this.listaPrecioService.calcularPrecio(this.precioBaseProducto(producto), listaPrecio)
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

  async obtenerListaPrecioActiva(
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

  precioBaseProducto(producto: Producto): number {
    const precioVenta = Number(producto.precio_venta ?? 0);
    if (Number.isFinite(precioVenta) && precioVenta > 0) return precioVenta;
    const precioBase = Number(producto.precio_base ?? 0);
    return Number.isFinite(precioBase) ? precioBase : 0;
  }

  requiereStockDisponible(tipo: TipoComprobante): boolean {
    return [
      TipoComprobante.VENTA,
      TipoComprobante.TICKET,
      TipoComprobante.FACTURA_A,
      TipoComprobante.FACTURA_B,
      TipoComprobante.FACTURA_C,
    ].includes(tipo);
  }

  round(value: number): number {
    return Number(Number(value).toFixed(2));
  }

  private async validarLotesVigentes(
    productoId: string,
    varianteId: string | null,
    sucursalId: string,
    cantidadSolicitada: number,
    nombreProducto: string,
  ): Promise<void> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const lotes = await this.loteRepo.find({
      where: {
        producto_id: productoId,
        variante_id: varianteId ?? IsNull(),
        sucursal_id: sucursalId,
        fecha_vencimiento: MoreThan(hoy),
      },
    });

    // Si no hay ningún lote vigente, también verificar con sucursal_id null (stock general)
    const lotesGenerales =
      lotes.length === 0
        ? await this.loteRepo.find({
            where: {
              producto_id: productoId,
              variante_id: varianteId ?? IsNull(),
              sucursal_id: IsNull(),
              fecha_vencimiento: MoreThan(hoy),
            },
          })
        : [];

    const todosMisLotes = [...lotes, ...lotesGenerales];

    if (todosMisLotes.length === 0) {
      // Verificar si existen lotes pero todos están vencidos
      const lotesVencidos = await this.loteRepo.count({
        where: {
          producto_id: productoId,
          variante_id: varianteId ?? IsNull(),
          fecha_vencimiento: LessThan(hoy),
        },
      });

      if (lotesVencidos > 0) {
        throw new BadRequestException(
          `No se puede vender "${nombreProducto}": todos los lotes están vencidos`,
        );
      }
      // Sin lotes registrados: el control de vencimiento está activo pero sin lotes cargados
      throw new BadRequestException(
        `No se puede vender "${nombreProducto}": el producto requiere control de vencimiento pero no tiene lotes cargados`,
      );
    }

    const stockVigente = todosMisLotes.reduce(
      (sum, lote) => sum + Number(lote.cantidad),
      0,
    );

    if (stockVigente < cantidadSolicitada) {
      const fechaMasProxima = todosMisLotes
        .map((l) => new Date(l.fecha_vencimiento))
        .sort((a, b) => a.getTime() - b.getTime())[0]
        .toLocaleDateString('es-AR');

      throw new BadRequestException(
        `Stock vigente insuficiente para "${nombreProducto}". ` +
          `Disponible en lotes no vencidos: ${stockVigente} (próximo vence: ${fechaMasProxima})`,
      );
    }
  }
}
