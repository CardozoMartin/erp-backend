import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Producto } from '../producto/entities/producto.entity';
import { Stock } from '../producto/entities/stock.entity';
import { Variante } from '../producto/entities/variante.entity';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(Variante)
    private readonly varianteRepo: Repository<Variante>,
  ) {}

  async create(dto: CreateStockDto): Promise<Stock> {
    const producto = await this.productoRepo.findOne({
      where: { id: dto.producto_id },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

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

  async findAll(): Promise<Stock[]> {
    return this.stockRepo.find({ relations: ['producto', 'variante'] });
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

  async remove(id: string): Promise<void> {
    const stock = await this.findOneOrFail(id);
    await this.stockRepo.remove(stock);
  }
}
