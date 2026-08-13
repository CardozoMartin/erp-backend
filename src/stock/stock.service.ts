import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, MoreThan, Not, Repository } from 'typeorm';
import { Producto } from '../producto/entities/producto.entity';
import { UnidadVenta } from '../producto/entities/producto.entity';
import { Stock } from './entities/stock.entity';
import { Variante } from '../variante/entities/variante.entity';
import { Sucursal } from '../sucursal/entities/sucursal.entity';
import { ConfiguracionSucursal } from '../configuracion/entities/configuracion.entity';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { AjustarStockDto } from './dto/create-stock.dto';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(Variante)
    private readonly varianteRepo: Repository<Variante>,
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
    @InjectRepository(ConfiguracionSucursal)
    private readonly configuracionRepo: Repository<ConfiguracionSucursal>,
  ) {}

  private validateWholeUnitStock(
    producto: Pick<Producto, 'unidad_venta' | 'es_fraccionable'>,
    cantidad: number | undefined,
    campo: string,
  ) {
    if (
      cantidad !== undefined &&
      producto.unidad_venta === UnidadVenta.UNIDAD &&
      !producto.es_fraccionable &&
      !Number.isInteger(cantidad)
    ) {
      throw new BadRequestException(
        `${campo} debe ser un número entero para productos vendidos por unidad`,
      );
    }
  }

  async create(dto: CreateStockDto): Promise<Stock> {
    const producto = await this.productoRepo.findOne({
      where: { id: dto.producto_id },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    this.validateWholeUnitStock(producto, dto.cantidad, 'La cantidad de stock');
    this.validateWholeUnitStock(
      producto,
      dto.cantidad_minima,
      'La cantidad mínima de stock',
    );

    let variante: Variante | null = null;
    if (dto.variante_id) {
      variante = await this.varianteRepo.findOne({
        where: { id: dto.variante_id },
      });
      if (!variante) throw new NotFoundException('Variante no encontrada');
      if (variante.producto_id !== dto.producto_id) {
        throw new BadRequestException(
          'La variante no pertenece al producto indicado',
        );
      }
    }

    const existente = await this.stockRepo.findOne({
      where: {
        producto_id: dto.producto_id,
        variante_id: dto.variante_id ?? IsNull(),
        sucursal_id: dto.sucursal_id ?? IsNull(),
      },
    });
    if (existente) {
      throw new BadRequestException(
        'Ya existe stock para ese producto, variante y sucursal',
      );
    }

    const stock = this.stockRepo.create({
      ...dto,
      producto: producto,
      variante: variante ?? undefined,
      variante_id: dto.variante_id ?? null,
      sucursal_id: dto.sucursal_id ?? null,
    } as Partial<Stock>);
    return this.stockRepo.save(stock);
  }

  async findAll(sucursalId: string): Promise<Stock[]> {
    return this.stockRepo.find({
      where: { sucursal_id: sucursalId },
      relations: ['producto', 'variante'],
    });
  }

  async findByProducto(productoId: string): Promise<Stock[]> {
    const producto = await this.productoRepo.findOne({
      where: { id: productoId },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    return this.stockRepo.find({
      where: { producto_id: productoId },
      relations: ['variante'],
    });
  }

  async findOneOrFail(id: string): Promise<Stock> {
    const stock = await this.stockRepo.findOne({
      where: { id },
      relations: ['producto', 'variante'],
    });
    if (!stock) throw new NotFoundException(`Stock ${id} no encontrado`);
    return stock;
  }

  async update(id: string, dto: UpdateStockDto): Promise<Stock> {
    const stock = await this.findOneOrFail(id);
    Object.assign(stock, dto);
    return this.stockRepo.save(stock);
  }

  // Suma o resta del stock actual (para movimientos de ventas/compras)
  async ajustar(id: string, dto: AjustarStockDto): Promise<Stock> {
    const stock = await this.findOneOrFail(id);
    const nuevaCantidad = Number(stock.cantidad) + dto.cantidad;
    if (nuevaCantidad < 0) {
      throw new BadRequestException('El stock no puede quedar negativo');
    }
    stock.cantidad = nuevaCantidad;
    return this.stockRepo.save(stock);
  }

  async remove(id: string): Promise<void> {
    const stock = await this.findOneOrFail(id);
    await this.stockRepo.remove(stock);
  }

  // Devuelve stocks con cantidad <= cantidad_minima (y cantidad_minima > 0)
  async alertasStock(sucursalId?: string): Promise<Stock[]> {
    const qb = this.stockRepo
      .createQueryBuilder('stock')
      .leftJoinAndSelect('stock.producto', 'producto')
      .leftJoinAndSelect('stock.variante', 'variante')
      .select([
        'stock.id',
        'stock.producto_id',
        'stock.variante_id',
        'stock.sucursal_id',
        'stock.cantidad',
        'stock.cantidad_minima',
        'stock.deposito',
        'stock.pasillo',
        'stock.estante',
        'stock.sector',
        'stock.codigo_ubicacion',
        'stock.ubicacion_referencia',
        'producto.id',
        'producto.nombre',
        'producto.codigo_barras',
        'producto.unidad_venta',
        'producto.es_fraccionable',
        'variante.id',
        'variante.sku',
      ])
      .where('stock.cantidad_minima > 0')
      .andWhere('stock.cantidad <= stock.cantidad_minima')
      .orderBy('stock.cantidad', 'ASC');

    if (sucursalId) {
      qb.andWhere('stock.sucursal_id = :sucursalId', { sucursalId });
    }

    return qb.getMany();
  }

  async conteoAlertas(sucursalId?: string): Promise<number> {
    const qb = this.stockRepo
      .createQueryBuilder('stock')
      .where('stock.cantidad_minima > 0')
      .andWhere('stock.cantidad <= stock.cantidad_minima');

    if (sucursalId) {
      qb.andWhere('stock.sucursal_id = :sucursalId', { sucursalId });
    }

    return qb.getCount();
  }

  async stockOtrasSucursales(
    productoId: string,
    sucursalActivaId: string,
  ): Promise<{ sucursal_id: string; nombre: string; cantidad: number; variante: string | null }[]> {
    const config = await this.configuracionRepo.findOne({
      where: { sucursal_id: sucursalActivaId },
    });
    if (!config?.consulta_stock_otras_sucursales) {
      throw new ForbiddenException('La consulta de stock en otras sucursales no está habilitada');
    }

    const stocks = await this.stockRepo.find({
      where: {
        producto_id: productoId,
        sucursal_id: Not(sucursalActivaId),
      },
      relations: ['variante'],
    });

    if (!stocks.length) return [];

    const sucursalIds = [...new Set(stocks.map((s) => s.sucursal_id).filter(Boolean) as string[])];
    const sucursales = await this.sucursalRepo.findByIds(sucursalIds);
    const sucursalesById = new Map(sucursales.map((s) => [s.id, s]));

    return stocks.map((stock) => ({
      sucursal_id: stock.sucursal_id ?? '',
      nombre: sucursalesById.get(stock.sucursal_id ?? '')?.nombre ?? 'Otra sucursal',
      cantidad: Number(stock.cantidad),
      variante: stock.variante?.sku ?? null,
    }));
  }
}
