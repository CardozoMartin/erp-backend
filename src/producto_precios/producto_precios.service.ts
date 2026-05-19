import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductoPrecioDto } from './dto/create-producto_precio.dto';
import { UpdateProductoPrecioDto } from './dto/update-producto_precio.dto';
import { ProductoPrecio } from './entities/producto_precio.entity';
import { MarcaProducto } from 'src/marca_productos/entities/marca_producto.entity';
import { Producto } from 'src/producto/entities/producto.entity';

@Injectable()
export class ProductoPreciosService {
  constructor(
    @InjectRepository(ProductoPrecio)
    private readonly productoPrecioRepository: Repository<ProductoPrecio>,
    @InjectRepository(MarcaProducto)
    private readonly marcaProductoRepository: Repository<MarcaProducto>,
    @InjectRepository(Producto)
    private readonly productoRepository: Repository<Producto>,
  ) {}

  //Servicio para crear un nuevo precio de producto
  create(
    createProductoPrecioDto: CreateProductoPrecioDto,
  ): Promise<ProductoPrecio> {
    if (createProductoPrecioDto.precio < 0) {
      throw new BadRequestException('El precio no puede ser negativo');
    }
    const precio = this.productoPrecioRepository.create(
      createProductoPrecioDto,
    );
    return this.productoPrecioRepository.save(precio);
  }
  // Obtener todos los precios de un producto
  async findByProducto(productoId: string): Promise<ProductoPrecio[]> {
    return this.productoPrecioRepository.find({
      where: { producto_id: productoId },
      order: { vigente_desde: 'DESC' },
    });
  }

  // Obtener el precio vigente actual para un producto y sucursal
  async getPrecioVigente(
    productoId: string,
    sucursalId?: string,
  ): Promise<ProductoPrecio | null> {
    const hoy = new Date().toISOString().split('T')[0];

    // Primero busca precio específico de sucursal
    if (sucursalId) {
      const precioSucursal = await this.productoPrecioRepository
        .createQueryBuilder('p')
        .where('p.producto_id = :productoId', { productoId })
        .andWhere('p.sucursal_id = :sucursalId', { sucursalId })
        .andWhere('p.vigente_desde <= :hoy', { hoy })
        .orderBy('p.vigente_desde', 'DESC')
        .getOne();

      if (precioSucursal) return precioSucursal;
    }

    // Si no hay precio por sucursal, busca el precio general
    return this.productoPrecioRepository
      .createQueryBuilder('p')
      .where('p.producto_id = :productoId', { productoId })
      .andWhere('p.sucursal_id IS NULL')
      .andWhere('p.vigente_desde <= :hoy', { hoy })
      .orderBy('p.vigente_desde', 'DESC')
      .getOne();
  }

  async update(
    id: string,
    dto: UpdateProductoPrecioDto,
  ): Promise<ProductoPrecio> {
    const precio = await this.productoPrecioRepository.findOne({
      where: { id },
    });
    if (!precio) {
      throw new NotFoundException(`Precio con ID ${id} no encontrado`);
    }
    Object.assign(precio, dto);
    return this.productoPrecioRepository.save(precio);
  }

  async remove(id: string): Promise<void> {
    const precio = await this.productoPrecioRepository.findOne({
      where: { id },
    });
    if (!precio) {
      throw new NotFoundException(`Precio con ID ${id} no encontrado`);
    }
    await this.productoPrecioRepository.remove(precio);
  }

  //servicio para aumentar el precio de los productos por un porcentaje dado
  async aumentarPreciosPorcentaje(
    productoId: string,
    porcentaje: number,
  ): Promise<void> {
    const precios = await this.findByProducto(productoId);
    for (const precio of precios) {
      precio.precio = precio.precio * (1 + porcentaje / 100);
      await this.productoPrecioRepository.save(precio);
    }
  }

  //servicio para aumentar el precio de los productos segun la marca del producto
  async aumentarPreciosPorMarca(
    marcaId: string,
    porcentaje: number,
  ): Promise<void> {
    const marca = await this.marcaProductoRepository.findOne({
      where: { id: marcaId },
    });
    if (!marca) {
      throw new NotFoundException(`Marca con ID ${marcaId} no encontrada`);
    }
    const productos = await this.productoRepository.find({
      where: { marca_id: marcaId },
    });
    for (const producto of productos) {
      await this.aumentarPreciosPorcentaje(producto.id, porcentaje);
    }
  }
}
