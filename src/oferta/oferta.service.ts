import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Oferta } from '../producto/entities/oferta.entity';
import { Producto } from '../producto/entities/producto.entity';
import { Variante } from '../producto/entities/variante.entity';
import { CreateOfertaDto } from './dto/create-oferta.dto';
import { UpdateOfertaDto } from './dto/update-oferta.dto';

@Injectable()
export class OfertaService {
  constructor(
    @InjectRepository(Oferta)
    private readonly ofertaRepo: Repository<Oferta>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(Variante)
    private readonly varianteRepo: Repository<Variante>,
  ) {}

  async create(dto: CreateOfertaDto): Promise<Oferta> {
    const producto = await this.productoRepo.findOne({ where: { id: dto.producto_id } });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    if (dto.fecha_inicio > dto.fecha_fin) {
      throw new BadRequestException('La fecha de inicio no puede ser mayor a la fecha fin');
    }

    let variante: Variante | null = null;
    if (dto.variante_id) {
      variante = await this.varianteRepo.findOne({ where: { id: dto.variante_id } });
      if (!variante) throw new NotFoundException('Variante no encontrada');
      if (variante.producto_id !== dto.producto_id) {
        throw new BadRequestException('La variante no pertenece al producto indicado');
      }
    }

    const oferta = this.ofertaRepo.create({
      ...dto,
      producto: producto,
      variante: variante ?? undefined,
      variante_id: dto.variante_id ?? null,
    } as Partial<Oferta>);
    return this.ofertaRepo.save(oferta);
  }

  async findAll(): Promise<Oferta[]> {
    return this.ofertaRepo.find({ relations: ['producto', 'variante'] });
  }

  async findOneOrFail(id: string): Promise<Oferta> {
    const oferta = await this.ofertaRepo.findOne({
      where: { id },
      relations: ['producto', 'variante'],
    });
    if (!oferta) throw new NotFoundException(`Oferta ${id} no encontrada`);
    return oferta;
  }

  async update(id: string, dto: UpdateOfertaDto): Promise<Oferta> {
    const oferta = await this.findOneOrFail(id);
    Object.assign(oferta, dto);
    return this.ofertaRepo.save(oferta);
  }

  async remove(id: string): Promise<void> {
    const oferta = await this.findOneOrFail(id);
    await this.ofertaRepo.remove(oferta);
  }
}
