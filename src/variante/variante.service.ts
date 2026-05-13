import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Variante } from '../producto/entities/variante.entity';
import { Producto } from '../producto/entities/producto.entity';
import { CreateVarianteDto } from './dto/create-variante.dto';
import { UpdateVarianteDto } from './dto/update-variante.dto';

@Injectable()
export class VarianteService {
  constructor(
    @InjectRepository(Variante)
    private readonly varianteRepo: Repository<Variante>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
  ) {}

  async create(dto: CreateVarianteDto): Promise<Variante> {
    const producto = await this.productoRepo.findOne({ where: { id: dto.producto_id } });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    if (dto.sku) {
      const existeSku = await this.varianteRepo.findOne({ where: { sku: dto.sku } });
      if (existeSku) throw new BadRequestException('El SKU ya existe');
    }

    const variante = this.varianteRepo.create({
      ...dto,
      producto: producto,
    });
    return this.varianteRepo.save(variante);
  }

  async findAll(): Promise<Variante[]> {
    return this.varianteRepo.find({ relations: ['producto', 'atributos'] });
  }

  async findOneOrFail(id: string): Promise<Variante> {
    const variante = await this.varianteRepo.findOne({
      where: { id },
      relations: ['producto', 'atributos'],
    });
    if (!variante) throw new NotFoundException(`Variante ${id} no encontrada`);
    return variante;
  }

  async update(id: string, dto: UpdateVarianteDto): Promise<Variante> {
    const variante = await this.findOneOrFail(id);
    Object.assign(variante, dto);
    return this.varianteRepo.save(variante);
  }

  async remove(id: string): Promise<void> {
    const variante = await this.findOneOrFail(id);
    await this.varianteRepo.remove(variante);
  }
}
