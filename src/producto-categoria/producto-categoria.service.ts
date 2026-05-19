import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCategoriaAtributoDto } from './dto/create-categoria-atributo.dto';
import { CreateProductoCategoriaDto } from './dto/create-producto-categoria.dto';
import { UpdateCategoriaAtributoDto } from './dto/update-categoria-atributo.dto';
import { UpdateProductoCategoriaDto } from './dto/update-producto-categoria.dto';
import { CategoriaAtributoDef } from './entities/categoria-atributoDef';
import { ProductoCategoria } from './entities/producto-categoria.entity';

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
      relations: ['padre', 'hijos', 'atributos'],
      order: { nombre: 'ASC' },
    });
  }

  //Servicio para obtener todas las categorias que estan activas
  async findAllActivas(page: number = 1, limit: number = 10) {
    const [categorias, total] = await this.categoriaRepository.findAndCount({
      where: { activo: true },
      relations: ['padre', 'hijos', 'atributos'],
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
      relations: ['padre', 'hijos', 'atributos'],
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

  // ─── Métodos para manejar atributos ───
  async addAtributo(
    categoriaId: string,
    createAtributoDto: CreateCategoriaAtributoDto,
  ) {
    const categoria = await this.findOne(categoriaId);
    if (!categoria) {
      throw new NotFoundException(
        `Categoría con ID ${categoriaId} no encontrada`,
      );
    }

    const nuevoAtributo = this.atributoRepository.create({
      ...createAtributoDto,
      categoria,
    });
    return await this.atributoRepository.save(nuevoAtributo);
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

    const atributoActualizado = this.atributoRepository.merge(
      atributo,
      updateAtributoDto,
    );
    return await this.atributoRepository.save(atributoActualizado);
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
    return await this.atributoRepository.remove(atributo);
  }

  async getAtributosByCategoria(categoriaId: string) {
    await this.findOne(categoriaId); // Validar que la categoría existe

    return await this.atributoRepository.find({
      where: { categoria_id: categoriaId },
      order: { orden: 'ASC' },
    });
  }
}
