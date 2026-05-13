import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lote } from '../producto/entities/lote.entity';
import { Producto } from '../producto/entities/producto.entity';
import { Variante } from '../producto/entities/variante.entity';
import { CreateLoteDto } from './dto/create-lote.dto';
import { UpdateLoteDto } from './dto/update-lote.dto';

@Injectable()
export class LoteService {
  constructor(
    @InjectRepository(Lote)
    private readonly loteRepo: Repository<Lote>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(Variante)
    private readonly varianteRepo: Repository<Variante>,
  ) {}

  async create(dto: CreateLoteDto): Promise<Lote> {
    const producto = await this.productoRepo.findOne({ where: { id: dto.producto_id } });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    if (!producto.tiene_vencimiento) {
      throw new BadRequestException('El producto no admite lotes con vencimiento');
    }

    let variante: Variante | null = null;
    if (dto.variante_id) {
      variante = await this.varianteRepo.findOne({ where: { id: dto.variante_id } });
      if (!variante) throw new NotFoundException('Variante no encontrada');
      if (variante.producto_id !== dto.producto_id) {
        throw new BadRequestException('La variante no pertenece al producto indicado');
      }
    }

    const lote = this.loteRepo.create({
      ...dto,
      producto: producto,
      variante: variante ?? undefined,
      variante_id: dto.variante_id ?? null,
    } as Partial<Lote>);
    return this.loteRepo.save(lote);
  }

  async findAll(): Promise<Lote[]> {
    return this.loteRepo.find({ relations: ['producto', 'variante'] });
  }

  async findOneOrFail(id: string): Promise<Lote> {
    const lote = await this.loteRepo.findOne({
      where: { id },
      relations: ['producto', 'variante'],
    });
    if (!lote) throw new NotFoundException(`Lote ${id} no encontrado`);
    return lote;
  }

  async update(id: string, dto: UpdateLoteDto): Promise<Lote> {
    const lote = await this.findOneOrFail(id);
    Object.assign(lote, dto);
    return this.loteRepo.save(lote);
  }

  async remove(id: string): Promise<void> {
    const lote = await this.findOneOrFail(id);
    await this.loteRepo.remove(lote);
  }
}
