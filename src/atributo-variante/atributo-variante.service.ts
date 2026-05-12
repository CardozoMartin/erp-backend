import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AtributoVariante } from '../producto/entities/atributo-variante.entity';
import { Variante } from '../producto/entities/variante.entity';
import { CreateAtributoVarianteDto } from './dto/create-atributo-variante.dto';
import { UpdateAtributoVarianteDto } from './dto/update-atributo-variante.dto';

@Injectable()
export class AtributoVarianteService {
  constructor(
    @InjectRepository(AtributoVariante)
    private readonly atributoRepo: Repository<AtributoVariante>,
    @InjectRepository(Variante)
    private readonly varianteRepo: Repository<Variante>,
  ) {}

  async create(dto: CreateAtributoVarianteDto): Promise<AtributoVariante> {
    const variante = await this.varianteRepo.findOne({ where: { id: dto.variante_id } });
    if (!variante) throw new NotFoundException('Variante no encontrada');

    const atributo = this.atributoRepo.create({
      ...dto,
      metadata: dto.metadata ?? null,
      variante: variante,
    });
    return this.atributoRepo.save(atributo);
  }

  async findAll(): Promise<AtributoVariante[]> {
    return this.atributoRepo.find({ relations: ['variante'] });
  }

  async findOneOrFail(id: string): Promise<AtributoVariante> {
    const atributo = await this.atributoRepo.findOne({
      where: { id },
      relations: ['variante'],
    });
    if (!atributo) throw new NotFoundException(`Atributo ${id} no encontrado`);
    return atributo;
  }

  async update(id: string, dto: UpdateAtributoVarianteDto): Promise<AtributoVariante> {
    const atributo = await this.findOneOrFail(id);
    Object.assign(atributo, dto);
    return this.atributoRepo.save(atributo);
  }

  async remove(id: string): Promise<void> {
    const atributo = await this.findOneOrFail(id);
    await this.atributoRepo.remove(atributo);
  }
}
