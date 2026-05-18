import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Producto } from '../producto/entities/producto.entity';
import { DataSource, Repository } from 'typeorm';
import { CreateVentasModuloDto } from './dto/create-ventas-modulo.dto';
import { VentaHistorial } from './entities/venta-historial.entity';
import { VentaItem } from './entities/venta-item.entity';
import { VentaPago } from './entities/venta-pago.entity';
import { ESTADO, VentasModulo } from './entities/ventas-modulo.entity';

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
    private dataSource: DataSource,
  ) {}

  //Vamos a generar la orden de venta como puede ser en estado de orden_de_venta, guardando los items y calculando totales.
  async create(createVentasModuloDto: CreateVentasModuloDto) {
    if (
      !createVentasModuloDto.items ||
      createVentasModuloDto.items.length === 0
    ) {
      throw new BadRequestException('Debe incluir al menos un item');
    }

    return this.dataSource.transaction(async (em) => {
      const itemsToSave: VentaItem[] = [];
      let subtotal = 0;
      let descuento_total = 0;
      let total = 0;

      for (const item of createVentasModuloDto.items) {
        const producto = await em.findOne(Producto, {
          where: { id: item.producto_id },
        });
        if (!producto) {
          throw new BadRequestException(
            `Producto con ID ${item.producto_id} no encontrado`,
          );
        }

        const precioUnitario =
          item.precio_unitario ?? Number(producto.precio_base);
        const cantidad = Number(item.cantidad);
        const descuentoPorcentaje = Number(item.descuento_porcentaje ?? 0);
        const subtotalItem = precioUnitario * cantidad;
        const descuentoMonto = (subtotalItem * descuentoPorcentaje) / 100;
        const totalItem = subtotalItem - descuentoMonto;

        subtotal += subtotalItem;
        descuento_total += descuentoMonto;
        total += totalItem;

        const ventaItem = em.create(VentaItem, {
          venta_id: '',
          producto_id: producto.id,
          variante_id: item.variante_id,
          descripcion: producto.nombre,
          precio_unitario: precioUnitario,
          cantidad,
          cantidad_retirada: 0,
          descuento_porcentaje: descuentoPorcentaje,
          descuento_monto: descuentoMonto,
          total: totalItem,
        });
        itemsToSave.push(ventaItem);
      }

      const venta = em.create(VentasModulo, {
        estado: createVentasModuloDto.estado ?? ESTADO.ORDEN_DE_VENTA,
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

      for (const item of itemsToSave) {
        item.venta_id = venta.id;
      }
      await em.save(itemsToSave);

      return venta;
    });
  }

  async update(id: string, updateVentasModuloDto: any) {
    return 'Funcionalidad de actualización no implementada';
  }

  async findAll() {
    return this.ventasModuloRepo.find({ order: { created_at: 'DESC' } });
  }

  async findOne(id: string) {
    return this.ventasModuloRepo.findOne({ where: { id } });
  }

  async remove(id: string) {
    throw new Error('No implementado');
  }
}
