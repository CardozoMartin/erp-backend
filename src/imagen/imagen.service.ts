import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Imagen } from '../producto/entities/imagen.entity';
import { Producto } from '../producto/entities/producto.entity';
import { Variante } from '../producto/entities/variante.entity';
import { CreateImagenDto } from './dto/create-imagen.dto';
import { UpdateImagenDto } from './dto/update-imagen.dto';

@Injectable()
export class ImagenService {
  constructor(
    @InjectRepository(Imagen)
    private readonly imagenRepo: Repository<Imagen>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(Variante)
    private readonly varianteRepo: Repository<Variante>,
  ) {}

  async create(dto: CreateImagenDto): Promise<Imagen> {
    const producto = await this.productoRepo.findOne({ where: { id: dto.producto_id } });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    let variante: Variante | null = null;
    if (dto.variante_id) {
      variante = await this.varianteRepo.findOne({ where: { id: dto.variante_id } });
      if (!variante) throw new NotFoundException('Variante no encontrada');
      if (variante.producto_id !== dto.producto_id) {
        throw new BadRequestException('La variante no pertenece al producto indicado');
      }
    }

    const imagen = this.imagenRepo.create({
      ...dto,
      producto: producto,
      variante: variante,
      variante_id: dto.variante_id ?? null,
    });
    return this.imagenRepo.save(imagen);
  }

  async findAll(): Promise<Imagen[]> {
    return this.imagenRepo.find({ relations: ['producto', 'variante'] });
  }

  async findOneOrFail(id: string): Promise<Imagen> {
    const imagen = await this.imagenRepo.findOne({
      where: { id },
      relations: ['producto', 'variante'],
    });
    if (!imagen) throw new NotFoundException(`Imagen ${id} no encontrada`);
    return imagen;
  }

  async update(id: string, dto: UpdateImagenDto): Promise<Imagen> {
    const imagen = await this.findOneOrFail(id);
    Object.assign(imagen, dto);
    return this.imagenRepo.save(imagen);
  }

  async remove(id: string): Promise<void> {
    const imagen = await this.findOneOrFail(id);
    await this.imagenRepo.remove(imagen);
  }
}
