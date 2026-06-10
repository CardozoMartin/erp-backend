import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductoCategoria } from './entities/producto-categoria.entity';
import { CreateProductoCategoriaDto } from './dto/create-producto-categoria.dto';
import { UpdateProductoCategoriaDto } from './dto/update-producto-categoria.dto';
import { CategoriaAtributoDef } from './entities/categoria-atributoDef';
import { CreateCategoriaAtributoDto } from './dto/create-categoria-atributo.dto';
import { UpdateCategoriaAtributoDto } from './dto/update-categoria-atributo.dto';

@Injectable()
export class ProductoCategoriaService {
  constructor(
    @InjectRepository(ProductoCategoria)
    private categoriaRepository: Repository<ProductoCategoria>,
    @InjectRepository(CategoriaAtributoDef)
    private atributoRepository: Repository<CategoriaAtributoDef>,
  ) {}

  async create(createProductoCategoriaDto: CreateProductoCategoriaDto) {
    // Validar que padre_id existe si se proporciona
    if (createProductoCategoriaDto.padre_id) {
      const padreExiste = await this.categoriaRepository.findOne({
        where: { id: createProductoCategoriaDto.padre_id },
      });
      if (!padreExiste) {
        throw new BadRequestException(
          `La categoría padre con ID ${createProductoCategoriaDto.padre_id} no existe`,
        );
      }
    }

    const nuevaCategoria = this.categoriaRepository.create(
      createProductoCategoriaDto,
    );
    return await this.categoriaRepository.save(nuevaCategoria);
  }

  async findAll() {
    return await this.categoriaRepository.find({
      relations: ['padre', 'hijos'],
      order: { nombre: 'ASC' },
    });
  }

  //Servicio para obtener todas las categorias que estan activas
  async findAllActivas(page: number = 1, limit: number = 10) {
    const [categorias, total] = await this.categoriaRepository.findAndCount({
      where: { activo: true },
      relations: ['padre', 'hijos'],
      order: { nombre: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: categorias,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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
  //servicio para actualizar la categoria
  async update(
    id: string,
    updateProductoCategoriaDto: UpdateProductoCategoriaDto,
  ) {
    const categoria = await this.findOne(id);

    // Validar que padre_id existe si se proporciona
    if (
      updateProductoCategoriaDto.padre_id !== undefined &&
      updateProductoCategoriaDto.padre_id
    ) {
      const padreExiste = await this.categoriaRepository.findOne({
        where: { id: updateProductoCategoriaDto.padre_id },
      });
      if (!padreExiste) {
        throw new BadRequestException(
          `La categoría padre con ID ${updateProductoCategoriaDto.padre_id} no existe`,
        );
      }
    }

    const categoriaActualizada = this.categoriaRepository.merge(
      categoria,
      updateProductoCategoriaDto,
    );
    return await this.categoriaRepository.save(categoriaActualizada);
  }
  //servicio para cambiar el estado de la categoria a inactiva o activa
  async toggleActivo(id: string) {
    const categoria = await this.findOne(id);
    categoria.activo = !categoria.activo;
    return await this.categoriaRepository.save(categoria);
  }

  async remove(id: string) {
    const categoria = await this.findOne(id);
    return await this.categoriaRepository.remove(categoria);
  }

  async addAtributo(
    categoriaId: string,
    createAtributoDto: CreateCategoriaAtributoDto,
  ) {
    await this.findOne(categoriaId);
    const atributo = this.atributoRepository.create({
      categoria_id: categoriaId,
      nombre: createAtributoDto.nombre,
      requerido: createAtributoDto.requerido ?? false,
      orden: createAtributoDto.orden ?? 0,
    });
    return this.atributoRepository.save(atributo);
  }

  async getAtributosByCategoria(categoriaId: string) {
    await this.findOne(categoriaId);
    return this.atributoRepository.find({
      where: { categoria_id: categoriaId },
      order: { orden: 'ASC', nombre: 'ASC' },
    });
  }

  async updateAtributo(
    atributoId: string,
    updateAtributoDto: UpdateCategoriaAtributoDto,
  ) {
    const atributo = await this.atributoRepository.findOne({
      where: { id: atributoId },
    });
    if (!atributo) {
      throw new NotFoundException(
        `Atributo con ID ${atributoId} no encontrado`,
      );
    }

    const actualizado = this.atributoRepository.merge(
      atributo,
      updateAtributoDto,
    );
    return this.atributoRepository.save(actualizado);
  }

  async removeAtributo(atributoId: string) {
    const atributo = await this.atributoRepository.findOne({
      where: { id: atributoId },
    });
    if (!atributo) {
      throw new NotFoundException(
        `Atributo con ID ${atributoId} no encontrado`,
      );
    }
    return this.atributoRepository.remove(atributo);
  }
}
