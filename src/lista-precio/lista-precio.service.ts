import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ListaPrecio,
  ModoIvaListaPrecio,
  TipoAjustePrecio,
} from './entities/lista-precio.entity';
import { CreateListaPrecioDto } from './dto/create-lista-precio.dto';

@Injectable()
export class ListaPrecioService {
  constructor(
    @InjectRepository(ListaPrecio)
    private readonly repo: Repository<ListaPrecio>,
  ) {}

  create(
    dto: CreateListaPrecioDto,
    sucursalActivaId?: string | null,
  ): Promise<ListaPrecio> {
    const lista = this.repo.create(
      this.normalizarDtoConSucursal(dto, sucursalActivaId),
    );
    return this.repo.save(lista);
  }

  findAll(sucursalId?: string, includeInactive = false): Promise<ListaPrecio[]> {
    const query = this.repo
      .createQueryBuilder('lp')
      .where(
        // Traer las globales (null) y las de la sucursal actual
        '(lp.sucursal_id IS NULL OR lp.sucursal_id = :sucursalId)',
        { sucursalId },
      )
      .orderBy('lp.nombre', 'ASC');

    if (!includeInactive) {
      query.andWhere('lp.activa = true');
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<ListaPrecio> {
    const lista = await this.repo.findOne({ where: { id } });
    if (!lista)
      throw new NotFoundException(`Lista de precio ${id} no encontrada`);
    return lista;
  }

  async update(
    id: string,
    dto: Partial<CreateListaPrecioDto>,
    sucursalActivaId?: string | null,
  ): Promise<ListaPrecio> {
    const lista = await this.findOne(id);
    if (lista.sucursal_id && lista.sucursal_id !== sucursalActivaId) {
      throw new ForbiddenException('No podes modificar una lista de otra sucursal');
    }
    Object.assign(lista, this.normalizarDtoConSucursal(dto, sucursalActivaId));
    return this.repo.save(lista);
  }

  async remove(id: string): Promise<void> {
    const lista = await this.findOne(id);
    await this.repo.remove(lista);
  }

  // Calcular precio final aplicando la lista
  calcularPrecio(precioBase: number, lista: ListaPrecio): number {
    const factor = lista.porcentaje / 100;
    const precioAjustado =
      lista.tipo_ajuste === TipoAjustePrecio.DESCUENTO
        ? precioBase * (1 - factor)
        : precioBase * (1 + factor);
    const ivaFactor = Number(lista.porcentaje_iva ?? 0) / 100;
    const precioConIva =
      lista.modo_iva === ModoIvaListaPrecio.AGREGAR_IVA
        ? precioAjustado * (1 + ivaFactor)
        : precioAjustado;
    return Number(precioConIva.toFixed(2));
  }

  private normalizarDtoConSucursal<T extends Partial<CreateListaPrecioDto>>(
    dto: T,
    sucursalActivaId?: string | null,
  ): T {
    const activa =
      dto.activa === undefined
        ? undefined
        : dto.activa === true || String(dto.activa).toLowerCase() === 'true';

    return {
      ...dto,
      nombre: dto.nombre?.trim(),
      descripcion: dto.descripcion?.trim() || null,
      sucursal_id: dto.sucursal_id === null ? null : sucursalActivaId || null,
      ...(activa === undefined ? {} : { activa }),
    };
  }
}
