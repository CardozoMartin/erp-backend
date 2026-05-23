import { Injectable } from '@nestjs/common';
import { CreateMarcaProductoDto } from './dto/create-marca_producto.dto';
import { UpdateMarcaProductoDto } from './dto/update-marca_producto.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { MarcaProducto } from './entities/marca_producto.entity';
import { Repository } from 'typeorm';

@Injectable()
export class MarcaProductosService {
  constructor(
    @InjectRepository(MarcaProducto)
    private readonly marcaProductoRepo: Repository<MarcaProducto>,
  ) {}
  async create(createMarcaProductoDto: CreateMarcaProductoDto) {
    //1.- verificamos que no exista una marca con el mismo nombre
    const existingMarca = await this.findOneName(createMarcaProductoDto.nombre);
    if (existingMarca) {
      throw new Error('Ya existe una marca con ese nombre');
    }
    const marcaProducto = this.marcaProductoRepo.create(createMarcaProductoDto);
    return this.marcaProductoRepo.save(marcaProducto);
  }

  async findAll(page: number = 1, limit: number = 30) {
    const [result, total] = await this.marcaProductoRepo.findAndCount({
      order: { nombre: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: result,
      total,
      page,
      last_page: Math.ceil(total / limit),
    };
  }

  async findOneName(nombre: string) {
    const marcaProducto = await this.marcaProductoRepo.findOneBy({ nombre });
    return marcaProducto;
  }

  async findOne(id: string) {
    const marcaProducto = await this.marcaProductoRepo.findOneBy({ id });
    return marcaProducto;
  }

  async update(id: string, updateMarcaProductoDto: UpdateMarcaProductoDto) {
    const marcaProducto = await this.findOne(id);
    if (!marcaProducto) {
      throw new Error('Marca de producto no encontrada');
    }
    Object.assign(marcaProducto, updateMarcaProductoDto);
    return this.marcaProductoRepo.save(marcaProducto);
  }

  async remove(id: string) {
    const marcaProducto = await this.findOne(id);
    // Si no se encuentra la marca de producto, lanzamos un error
    if (!marcaProducto) {
      throw new Error('Marca de producto no encontrada');
    }
    //si encontramos la marca de producto, solamente hacemos una baja logica
    const marcaProductoActivo = !marcaProducto.activo;
    marcaProducto.activo = marcaProductoActivo;
    return this.marcaProductoRepo.save(marcaProducto);
  }
}
