import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sucursal } from './entities/sucursal.entity';
import { CreateSucursalDto, UpdateSucursalDto } from './dto/create-sucursal.dto';

@Injectable()
export class SucursalService {
  constructor(
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
  ) {}

  async findAll(): Promise<Sucursal[]> {
    return this.sucursalRepo.find({ order: { nombre: 'ASC' } });
  }

  async findOne(id: string): Promise<Sucursal> {
    const sucursal = await this.sucursalRepo.findOne({ where: { id } });
    if (!sucursal) {
      throw new NotFoundException(`Sucursal ${id} no encontrada`);
    }
    return sucursal;
  }

  async create(dto: CreateSucursalDto): Promise<Sucursal> {
    const sucursal = this.sucursalRepo.create({
      ...dto,
      direccion: dto.direccion ?? null,
      telefono: dto.telefono ?? null,
      activa: dto.activa ?? true,
    });
    return this.sucursalRepo.save(sucursal);
  }

  async update(id: string, dto: UpdateSucursalDto): Promise<Sucursal> {
    const sucursal = await this.findOne(id);
    Object.assign(sucursal, dto);
    return this.sucursalRepo.save(sucursal);
  }

  async remove(id: string): Promise<void> {
    const sucursal = await this.findOne(id);
    await this.sucursalRepo.remove(sucursal);
  }
}
