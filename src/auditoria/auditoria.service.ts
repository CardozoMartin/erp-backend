import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditoriaEvento } from './entities/auditoria-evento.entity';

export type RegistrarAuditoriaParams = {
  modulo: string;
  accion: string;
  entidad?: string | null;
  entidad_id?: string | null;
  empleado_id?: string | null;
  sucursal_id?: string | null;
  descripcion?: string | null;
  antes?: Record<string, any> | null;
  despues?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
};

/**
 * Acciones que tocan plata, stock, permisos o borran cosas. Son las que primero
 * se miran cuando algo no cierra, por eso tienen filtro propio.
 *
 * El filtro corre en SQL y no sobre la pagina: filtrar en el front solo revisaba
 * los 50 registros visibles y decia "0 sensibles" cuando los habia en otra pagina.
 */
export const ACCIONES_SENSIBLES = [
  'ANULAR',
  'CANCELAR',
  'ELIMINAR',
  'DESACTIVAR',
  'PERMISO',
  'ROL',
  'STOCK',
  'COSTO',
  'PRECIO',
  'RENDIR',
  'CERRAR_CAJA',
  'AJUSTE',
  'OMITIR',
  'DEVOLVER',
  'REEMBOLSO',
];

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(AuditoriaEvento)
    private readonly repo: Repository<AuditoriaEvento>,
  ) {}

  registrar(params: RegistrarAuditoriaParams): Promise<AuditoriaEvento> {
    const evento = this.repo.create({
      modulo: params.modulo,
      accion: params.accion,
      entidad: params.entidad ?? null,
      entidad_id: params.entidad_id ?? null,
      empleado_id: params.empleado_id ?? null,
      sucursal_id: params.sucursal_id ?? null,
      descripcion: params.descripcion ?? null,
      antes: this.limpiar(params.antes),
      despues: this.limpiar(params.despues),
      metadata: this.limpiar(params.metadata),
    });
    return this.repo.save(evento);
  }

  findAll(filtros: {
    modulo?: string;
    accion?: string;
    empleado_id?: string;
    sucursal_id?: string;
    entidad?: string;
    entidad_id?: string;
    desde?: string;
    hasta?: string;
    q?: string;
    solo_sensibles?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(filtros.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filtros.limit || 50)));
    const query = this.repo.createQueryBuilder('auditoria');

    if (filtros.modulo) query.andWhere('auditoria.modulo = :modulo', { modulo: filtros.modulo });
    if (filtros.accion) query.andWhere('auditoria.accion = :accion', { accion: filtros.accion });
    if (filtros.empleado_id) query.andWhere('auditoria.empleado_id = :empleado_id', { empleado_id: filtros.empleado_id });
    if (filtros.sucursal_id) query.andWhere('auditoria.sucursal_id = :sucursal_id', { sucursal_id: filtros.sucursal_id });
    if (filtros.entidad) query.andWhere('auditoria.entidad = :entidad', { entidad: filtros.entidad });
    if (filtros.entidad_id) query.andWhere('auditoria.entidad_id = :entidad_id', { entidad_id: filtros.entidad_id });
    if (filtros.desde) query.andWhere('auditoria.created_at >= :desde', { desde: `${filtros.desde} 00:00:00` });
    if (filtros.hasta) query.andWhere('auditoria.created_at <= :hasta', { hasta: `${filtros.hasta} 23:59:59` });
    if (filtros.q) {
      query.andWhere(
        '(auditoria.descripcion LIKE :q OR auditoria.accion LIKE :q OR auditoria.entidad LIKE :q OR auditoria.entidad_id LIKE :q)',
        { q: `%${filtros.q}%` },
      );
    }
    if (filtros.solo_sensibles) {
      const condiciones = ACCIONES_SENSIBLES.map(
        (_, indice) => `auditoria.accion LIKE :sensible${indice}`,
      ).join(' OR ');
      const parametros = Object.fromEntries(
        ACCIONES_SENSIBLES.map((token, indice) => [`sensible${indice}`, `%${token}%`]),
      );
      query.andWhere(`(${condiciones})`, parametros);
    }

    return query
      .orderBy('auditoria.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()
      .then(([data, total]) => ({
        data,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      }));
  }

  /** Acciones distintas que existen en la base, opcionalmente de un modulo */
  async findAccionesDisponibles(
    sucursalId?: string,
    modulo?: string,
  ): Promise<string[]> {
    const query = this.repo
      .createQueryBuilder('auditoria')
      .select('DISTINCT auditoria.accion', 'accion');
    if (sucursalId) query.andWhere('auditoria.sucursal_id = :sucursalId', { sucursalId });
    if (modulo) query.andWhere('auditoria.modulo = :modulo', { modulo });
    const filas = await query.orderBy('accion', 'ASC').getRawMany<{ accion: string }>();
    return filas.map((fila) => fila.accion);
  }

  findHistorialEntidad(params: {
    entidad: string;
    entidad_id: string;
    sucursal_id?: string | null;
    page?: number;
    limit?: number;
  }) {
    return this.findAll({
      entidad: params.entidad,
      entidad_id: params.entidad_id,
      sucursal_id: params.sucursal_id ?? undefined,
      page: params.page ?? 1,
      limit: params.limit ?? 100,
    });
  }

  private limpiar(value?: Record<string, any> | null) {
    if (!value) return null;
    return JSON.parse(
      JSON.stringify(value, (key, item) => {
        if (['contrasena', 'password', 'token'].includes(key)) return undefined;
        return item;
      }),
    );
  }
}
