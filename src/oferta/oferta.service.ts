import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Oferta } from './entities/oferta.entity';
import { Producto } from '../producto/entities/producto.entity';
import { Variante } from '../variante/entities/variante.entity';
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
    //verificamos que el producto exista
    const producto = await this.productoRepo.findOne({
      where: { id: dto.producto_id },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    // verificamos que la fecha de inicio no sea mayor a la fecha fin
    if (dto.fecha_inicio > dto.fecha_fin) {
      throw new BadRequestException(
        'La fecha de inicio no puede ser mayor a la fecha fin',
      );
    }
    //verificamos que el producto tenga activa la oferta o vengan en el dto el campo activo en true
    let variante: Variante | null = null;
    if (dto.variante_id) {
      variante = await this.varianteRepo.findOne({
        where: { id: dto.variante_id },
      });
      if (!variante) throw new NotFoundException('Variante no encontrada');
      if (variante.producto_id !== dto.producto_id) {
        throw new BadRequestException(
          'La variante no pertenece al producto indicado',
        );
      }
    }

    // Advertir si ya existe una oferta vigente para este producto/variante
    const ofertaExistente = await this.findVigenteParaProducto(dto.producto_id, dto.variante_id);
    if (ofertaExistente) {
      throw new BadRequestException(
        `Ya existe una oferta vigente para este producto (precio: $${ofertaExistente.precio_oferta}). ` +
        `Eliminá o desactivá la oferta actual antes de crear una nueva.`,
      );
    }

    const oferta = this.ofertaRepo.create({
      ...dto,
      producto: producto,
      variante: variante ?? undefined,
      variante_id: dto.variante_id ?? null,
      cantidad_maxima: dto.cantidad_maxima ?? null,
      cantidad_vendida: 0,
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

  async findVigenteParaProducto(productoId: string, varianteId?: string): Promise<Oferta | null> {
    const ahora = new Date();

    const base = (qb: ReturnType<typeof this.ofertaRepo.createQueryBuilder>) =>
      qb
        .andWhere('o.activo = true')
        .andWhere('o.fecha_inicio <= :ahora', { ahora })
        .andWhere('o.fecha_fin >= :ahora', { ahora })
        // excluir ofertas agotadas: cantidad_maxima IS NULL (sin límite) o cantidad_vendida < cantidad_maxima
        .andWhere(
          '(o.cantidad_maxima IS NULL OR o.cantidad_vendida < o.cantidad_maxima)',
        )
        .orderBy('o.precio_oferta', 'ASC');

    if (varianteId) {
      const ofertaVariante = await base(
        this.ofertaRepo
          .createQueryBuilder('o')
          .where('o.producto_id = :productoId', { productoId })
          .andWhere('o.variante_id = :varianteId', { varianteId }),
      ).getOne();

      if (ofertaVariante) return ofertaVariante;
    }

    return base(
      this.ofertaRepo
        .createQueryBuilder('o')
        .where('o.producto_id = :productoId', { productoId })
        .andWhere('o.variante_id IS NULL'),
    ).getOne();
  }

  // Llamado al confirmar una venta para descontar unidades de la oferta vigente
  async consumirUnidades(productoId: string, varianteId: string | null, cantidad: number): Promise<void> {
    const oferta = await this.findVigenteParaProducto(productoId, varianteId ?? undefined);
    if (!oferta || oferta.cantidad_maxima === null) return;

    await this.ofertaRepo.update(oferta.id, {
      cantidad_vendida: Math.min(oferta.cantidad_vendida + cantidad, oferta.cantidad_maxima),
    });
  }
}
