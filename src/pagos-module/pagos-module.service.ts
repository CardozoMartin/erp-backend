import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MedioPago } from './entities/medio-pago.entity';
import { UpdatePagosModuleDto } from './dto/update-pagos-module.dto';
import { CrearMedioPagoDto } from './dto/create-pagos-module.dto';

@Injectable()
export class PagosModuleService {
  constructor(
    @InjectRepository(MedioPago)
    private readonly medioPagoRepo: Repository<MedioPago>,
  ) {}

  async create(dto: CrearMedioPagoDto): Promise<MedioPago> {
    const existe = await this.medioPagoRepo.findOne({
      where: { nombre: dto.nombre },
    });
    if (existe) {
      throw new ConflictException(`Ya existe un medio de pago "${dto.nombre}"`);
    }
    const medio = this.medioPagoRepo.create({
      ...dto,
      requiereReferencia: dto.requiereReferencia ?? false,
      activo: dto.activo ?? true,
    });
    return this.medioPagoRepo.save(medio);
  }

  async findAll(): Promise<MedioPago[]> {
    return this.medioPagoRepo.find({ order: { nombre: 'ASC' } });
  }

  async findActivos(): Promise<MedioPago[]> {
    return this.medioPagoRepo.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: string): Promise<MedioPago> {
    const medio = await this.medioPagoRepo.findOne({ where: { id } });
    if (!medio)
      throw new NotFoundException(`Medio de pago ${id} no encontrado`);
    return medio;
  }

  async findByIds(ids: string[]): Promise<MedioPago[]> {
    if (!ids.length) return [];
    const medios = await this.medioPagoRepo.findBy({ id: In(ids) });
    if (medios.length !== ids.length) {
      throw new ConflictException(`Algunos medios de pago no existen`);
    }
    return medios;
  }

  async update(id: string, dto: UpdatePagosModuleDto): Promise<MedioPago> {
    const medio = await this.findOne(id);
    if (dto.nombre && dto.nombre !== medio.nombre) {
      const existe = await this.medioPagoRepo.findOne({
        where: { nombre: dto.nombre },
      });
      if (existe) throw new ConflictException(`Ya existe "${dto.nombre}"`);
    }
    Object.assign(medio, dto);
    return this.medioPagoRepo.save(medio);
  }

  async toggleActivo(id: string): Promise<MedioPago> {
    const medio = await this.findOne(id);
    medio.activo = !medio.activo;
    return this.medioPagoRepo.save(medio);
  }
}
