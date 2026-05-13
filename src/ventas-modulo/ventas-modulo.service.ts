import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateVentaItemDto, CreateVentasModuloDto } from './dto/create-ventas-modulo.dto';
import { UpdateVentasModuloDto } from './dto/update-ventas-modulo.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Producto } from 'src/producto/entities/producto.entity';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { ESTADO, VentasModulo } from './entities/ventas-modulo.entity';
import { VentaItem } from './entities/venta-item.entity';
import { VentaHistorial } from './entities/venta-historial.entity';
import { VentaPago } from './entities/venta-pago.entity';
import { ConfirmarVentaDto } from './dto/confirmar-venta.dto';
import { FacturarVentaDto } from './dto/facturar-venta.dto';
import { RegistrarRetiroDto } from './dto/registrar-retiro.dto';
import { Stock } from '../producto/entities/stock.entity';
import { Variante } from '../producto/entities/variante.entity';

@Injectable()
export class VentasModuloService {

  constructor(
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(VentasModulo)
    private readonly ventasModuloRepo: Repository<VentasModulo>,
    @InjectRepository(VentaItem)
    private readonly ventaItemRepo: Repository<VentaItem>,
    @InjectRepository(VentaPago)
    private readonly ventaPagoRepo: Repository<VentaPago>,
    @InjectRepository(VentaHistorial)
    private readonly ventaHistorialRepo: Repository<VentaHistorial>,
    private dataSource: DataSource
  ){}

  //Primer paso crear cotizacion, luego convertir a venta, luego facturar. En cada paso se va guardando el estado y el historial.
  async create(createVentasModuloDto: CreateVentasModuloDto) {
    return this.dataSource.transaction(async (em) => {
      if (!createVentasModuloDto.items || createVentasModuloDto.items.length === 0) {
        throw new BadRequestException('Debe incluir al menos un item');
      }

      const itemsResueltos = await this.resolverItems(createVentasModuloDto.items, em);
      const { subtotal, descuento_total, total } = this.calcularTotales(itemsResueltos);

      const venta = em.create(VentasModulo, {
        estado: createVentasModuloDto.estado ?? ESTADO.COTIZACION,
        caja_id: createVentasModuloDto.caja_id,
        sucursal_id: createVentasModuloDto.sucursal_id,
        cliente_id: createVentasModuloDto.cliente_id,
        usuario_id: createVentasModuloDto.usuario_id,
        notas: createVentasModuloDto.notas,
        subtotal,
        descuento_total,
        total,
      });
      await em.save(venta);

      const items = itemsResueltos.map((i) =>
        em.create(VentaItem, { ...i, venta_id: venta.id }),
      );
      await em.save(items);

      await this.registrarHistorial(em, venta.id, null, venta.estado, createVentasModuloDto.usuario_id);

      return venta;
    });
  }

  async update(id: string, updateVentasModuloDto: UpdateVentasModuloDto, usuario_id?: string) {
    return this.dataSource.transaction(async (em) => {
      const venta = await this.getVentaOFail(id, em);
      this.assertEstado(venta, [ESTADO.COTIZACION]);

      if (updateVentasModuloDto.items) {
        if (updateVentasModuloDto.items.length === 0) {
          throw new BadRequestException('Debe incluir al menos un item');
        }
        await em.delete(VentaItem, { venta_id: id });
        const itemsResueltos = await this.resolverItems(updateVentasModuloDto.items, em);
        const { subtotal, descuento_total, total } = this.calcularTotales(itemsResueltos);
        const items = itemsResueltos.map((i) => em.create(VentaItem, { ...i, venta_id: id }));
        await em.save(items);
        Object.assign(venta, { subtotal, descuento_total, total });
      }

      if (updateVentasModuloDto.cliente_id !== undefined) venta.cliente_id = updateVentasModuloDto.cliente_id;
      if (updateVentasModuloDto.notas !== undefined) venta.notas = updateVentasModuloDto.notas;

      const actualizado = await em.save(venta);
      if (usuario_id) {
        await this.registrarHistorial(em, id, venta.estado, venta.estado, usuario_id, 'Actualizacion de cotizacion');
      }
      return actualizado;
    });
  }

  async confirmarOrden(id: string, dto: ConfirmarVentaDto, usuario_id: string) {
    return this.dataSource.transaction(async (em) => {
      const venta = await this.getVentaOFail(id, em);
      this.assertEstado(venta, [ESTADO.COTIZACION]);

      await this.validarStock(venta, em);

      if (dto.descuento_total_extra && dto.descuento_total_extra > 0) {
        venta.descuento_total = Number(venta.descuento_total) + dto.descuento_total_extra;
        venta.total = Number(venta.total) - dto.descuento_total_extra;
      }

      const anterior = venta.estado;
      venta.estado = ESTADO.ORDEN_DE_VENTA;
      await em.save(venta);
      await this.registrarHistorial(em, id, anterior, venta.estado, usuario_id);

      return venta;
    });
  }

  async registrarRetiro(id: string, dto: RegistrarRetiroDto, usuario_id: string) {
    return this.dataSource.transaction(async (em) => {
      const venta = await this.getVentaOFail(id, em);
      this.assertEstado(venta, [ESTADO.ORDEN_DE_VENTA, ESTADO.PARCIALMENTE_RETIRADO]);

      if (!venta.sucursal_id) {
        throw new BadRequestException('La venta no tiene sucursal asignada');
      }

      for (const r of dto.items) {
        const item = await em.findOneOrFail(VentaItem, { where: { id: r.venta_item_id } });
        const pendiente = Number(item.cantidad) - Number(item.cantidad_retirada);
        if (r.cantidad_retirada > pendiente) {
          throw new BadRequestException(
            `Item ${item.descripcion}: cantidad supera lo pendiente`,
          );
        }

        const stock = await em.findOne(Stock, {
          where: {
            producto_id: item.producto_id,
            variante_id: item.variante_id ?? IsNull(),
            sucursal_id: venta.sucursal_id,
          },
        });
        if (!stock) {
          throw new BadRequestException(
            `No existe stock para el item ${item.descripcion} en la sucursal`,
          );
        }
        if (Number(stock.cantidad) < r.cantidad_retirada) {
          throw new BadRequestException(
            `Stock insuficiente para el item ${item.descripcion}`,
          );
        }

        stock.cantidad = Number(stock.cantidad) - r.cantidad_retirada;
        item.cantidad_retirada = Number(item.cantidad_retirada) + r.cantidad_retirada;
        await em.save(stock);
        await em.save(item);
      }

      const todos = await em.find(VentaItem, { where: { venta_id: id } });
      const todoRetirado = todos.every(
        (i) => Number(i.cantidad) === Number(i.cantidad_retirada),
      );

      const anterior = venta.estado;
      venta.estado = todoRetirado ? ESTADO.RETIRADO : ESTADO.PARCIALMENTE_RETIRADO;
      await em.save(venta);
      await this.registrarHistorial(em, id, anterior, venta.estado, usuario_id);

      return venta;
    });
  }

  async facturar(id: string, dto: FacturarVentaDto, usuario_id: string) {
    return this.dataSource.transaction(async (em) => {
      const venta = await this.getVentaOFail(id, em);
      this.assertEstado(venta, [ESTADO.ORDEN_DE_VENTA, ESTADO.RETIRADO]);

      const anterior = venta.estado;
      venta.estado = ESTADO.FACTURADO;
      await em.save(venta);
      await this.registrarHistorial(
        em,
        id,
        anterior,
        venta.estado,
        usuario_id,
        `Comprobante ${dto.tipo_comprobante} ${dto.numero_comprobante ?? ''}`.trim(),
      );

      return venta;
    });
  }

  async registrarPago(
    id: string,
    pagos: { medio: string; monto: number; referencia?: string }[],
    usuario_id: string,
  ) {
    return this.dataSource.transaction(async (em) => {
      const venta = await this.getVentaOFail(id, em);
      this.assertEstado(venta, [ESTADO.FACTURADO, ESTADO.ORDEN_DE_VENTA]);

      const totalPagado = pagos.reduce((acc, p) => acc + p.monto, 0);
      if (totalPagado < Number(venta.total)) {
        throw new BadRequestException('El monto no cubre el total de la venta');
      }

      for (const p of pagos) {
        await em.save(
          em.create(VentaPago, {
            venta_id: id,
            medio_pago: p.medio,
            monto: p.monto,
            referencia: p.referencia,
          }),
        );
      }

      await this.registrarHistorial(em, id, venta.estado, venta.estado, usuario_id, 'Registro de pago');

      return { venta, pagos_registrados: pagos.length };
    });
  }

  async anular(id: string, motivo: string, usuario_id: string) {
    return this.dataSource.transaction(async (em) => {
      const venta = await this.getVentaOFail(id, em);
      if (venta.estado === ESTADO.ANULADO) {
        throw new BadRequestException('Ya esta anulada');
      }

      if (
        [
          ESTADO.ORDEN_DE_VENTA,
          ESTADO.PARCIALMENTE_RETIRADO,
          ESTADO.RETIRADO,
          ESTADO.FACTURADO,
        ].includes(venta.estado)
      ) {
        await this.revertirStock(venta, em);
      }

      const anterior = venta.estado;
      venta.estado = ESTADO.ANULADO;
      await em.save(venta);
      await this.registrarHistorial(em, id, anterior, venta.estado, usuario_id, motivo);

      return venta;
    });
  }

  async findAll() {
    return this.ventasModuloRepo.find({ order: { created_at: 'DESC' } });
  }

  async findOne(id: string) {
    return this.ventasModuloRepo.findOne({ where: { id } });
  }

  async remove(id: string) {
    const venta = await this.ventasModuloRepo.findOne({ where: { id } });
    if (!venta) {
      throw new BadRequestException('Venta no encontrada');
    }
    return this.ventasModuloRepo.remove(venta);
  }

  private async resolverItems(items: CreateVentaItemDto[], em: EntityManager) {
    return Promise.all(
      items.map(async (i) => {
        const producto = await em.findOneOrFail(Producto, { where: { id: i.producto_id } });
        let variante: Variante | null = null;
        if (i.variante_id) {
          variante = await em.findOneOrFail(Variante, { where: { id: i.variante_id } });
          if (variante.producto_id !== i.producto_id) {
            throw new BadRequestException('La variante no pertenece al producto indicado');
          }
        }
        const base = Number(producto.precio_base);
        const extra = variante ? Number(variante.precio_extra) : 0;
        const precio = i.precio_unitario ?? base + extra;
        const descuento_porcentaje = i.descuento_porcentaje ?? 0;
        const descuento_monto = (precio * i.cantidad * descuento_porcentaje) / 100;
        const total = precio * i.cantidad - descuento_monto;
        return {
          producto_id: i.producto_id,
          variante_id: i.variante_id,
          descripcion: producto.nombre,
          precio_unitario: precio,
          cantidad: i.cantidad,
          cantidad_retirada: 0,
          descuento_porcentaje,
          descuento_monto,
          total,
        };
      }),
    );
  }

  private calcularTotales(items: any[]) {
    const subtotal = items.reduce((a, i) => a + i.precio_unitario * i.cantidad, 0);
    const descuento_total = items.reduce((a, i) => a + i.descuento_monto, 0);
    const total = items.reduce((a, i) => a + i.total, 0);
    return { subtotal, descuento_total, total };
  }

  private async getVentaOFail(id: string, em: EntityManager) {
    return em.findOneOrFail(VentasModulo, { where: { id } });
  }

  private assertEstado(venta: VentasModulo, permitidos: ESTADO[]) {
    if (!permitidos.includes(venta.estado)) {
      throw new BadRequestException(
        `Estado actual '${venta.estado}' no permite esta operacion. Permitidos: ${permitidos.join(', ')}`,
      );
    }
  }

  private async registrarHistorial(
    em: EntityManager,
    venta_id: string,
    anterior: string | null,
    nuevo: string,
    usuario_id?: string,
    observacion?: string,
  ) {
    await em.save(
      em.create(VentaHistorial, {
        venta_id,
        estado_anterior: anterior,
        estado_nuevo: nuevo,
        usuario_id,
        observacion,
      }),
    );
  }

  private async validarStock(venta: VentasModulo, em: EntityManager) {
    if (!venta.sucursal_id) {
      throw new BadRequestException('La venta no tiene sucursal asignada');
    }
    const items = await em.find(VentaItem, { where: { venta_id: venta.id } });
    for (const item of items) {
      const stock = await em.findOne(Stock, {
        where: {
          producto_id: item.producto_id,
          variante_id: item.variante_id ?? IsNull(),
          sucursal_id: venta.sucursal_id,
        },
      });
      if (!stock) {
        throw new BadRequestException(
          `No existe stock para el item ${item.descripcion} en la sucursal`,
        );
      }
      if (Number(stock.cantidad) < Number(item.cantidad)) {
        throw new BadRequestException(
          `Stock insuficiente para el item ${item.descripcion}`,
        );
      }
    }
  }

  private async revertirStock(venta: VentasModulo, em: EntityManager) {
    if (!venta.sucursal_id) {
      return;
    }
    const items = await em.find(VentaItem, { where: { venta_id: venta.id } });
    for (const item of items) {
      if (Number(item.cantidad_retirada) === 0) continue;
      const stock = await em.findOne(Stock, {
        where: {
          producto_id: item.producto_id,
          variante_id: item.variante_id ?? IsNull(),
          sucursal_id: venta.sucursal_id,
        },
      });
      if (!stock) continue;
      stock.cantidad = Number(stock.cantidad) + Number(item.cantidad_retirada);
      await em.save(stock);
    }
  }
}
