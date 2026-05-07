import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductoCategoria } from './entities/producto-categoria.entity';
import { CreateProductoCategoriaDto } from './dto/create-producto-categoria.dto';
import { UpdateProductoCategoriaDto } from './dto/update-producto-categoria.dto';

@Injectable()
export class ProductoCategoriaService {
  constructor(
    @InjectRepository(ProductoCategoria)
    private categoriaRepository: Repository<ProductoCategoria>,
  ) {}

  async create(createProductoCategoriaDto: CreateProductoCategoriaDto) {
    const categoria = this.categoriaRepository.create(createProductoCategoriaDto);
    return await this.categoriaRepository.save(categoria);
  }

  async findAll() {
    return await this.categoriaRepository.find({
      relations: ['padre', 'hijos'],
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: string) {
    const categoria = await this.categoriaRepository.findOne({
      where: { id },
      relations: ['padre', 'hijos'],
    });
    if (!categoria) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }
    return categoria;
  }

  async update(id: string, updateProductoCategoriaDto: UpdateProductoCategoriaDto) {
    const categoria = await this.findOne(id);
    const actualizado = this.categoriaRepository.merge(categoria, updateProductoCategoriaDto);
    return await this.categoriaRepository.save(actualizado);
  }

  async remove(id: string) {
    const categoria = await this.findOne(id);
    return await this.categoriaRepository.remove(categoria);
  }
}
