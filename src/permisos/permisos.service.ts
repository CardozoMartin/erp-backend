import { ConflictException, Injectable } from '@nestjs/common';
import { CrearPermisoDto } from './dto/create-permiso.dto';
import { UpdatePermisoDto } from './dto/update-permiso.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Permiso } from './entities/permiso.entity';
import { In, Repository } from 'typeorm';

@Injectable()
export class PermisosService {
  constructor(
    @InjectRepository(Permiso)
    private readonly permisoRepository: Repository<Permiso>,
  ) {}
  //servicio para crear un nuevo permiso
  async create(createPermisoDto: CrearPermisoDto): Promise<Permiso> {
    //1.- primero verificamos que el permiso no exista
    const existePermiso = await this.permisoRepository.findOne({
      where: { clave: createPermisoDto.clave },
    });
    if (existePermiso) {
      throw new Error(
        `El permiso con clave ${createPermisoDto.clave} ya existe`,
      );
    }
    //2.- si no existe, lo creamos
    const nuevoPermiso = this.permisoRepository.create(createPermisoDto);
    return await this.permisoRepository.save(nuevoPermiso);
  }
  //servicio para obtener todos los permisos
  async findAll(): Promise<Permiso[]> {
    return await this.permisoRepository.find();
  }
  //servicio para obtener un permiso por su id
  async findOne(id: string): Promise<Permiso> {
    const permiso = await this.permisoRepository.findOne({ where: { id } });
    if (!permiso) {
      throw new Error(`El permiso con ID ${id} no existe`);
    }
    return permiso;
  }
  //servicio para actualizar un permiso por su id
  async update(
    id: string,
    updatePermisoDto: UpdatePermisoDto,
  ): Promise<Permiso> {
    //1.- primero verificamos que el permiso exista
    const existePermiso = await this.permisoRepository.findOne({
      where: { id },
    });
    if (!existePermiso) {
      throw new Error(`El permiso con ID ${id} no existe`);
    }
    //2.- si existe, lo actualizamos
    const permisoActualizado = this.permisoRepository.merge(
      existePermiso,
      updatePermisoDto,
    );
    return await this.permisoRepository.save(permisoActualizado);
  }
  //servicio para eliminar un permiso por su id
  async remove(id: string): Promise<void> {
    //1.- primero verificamos que el permiso exista
    const existePermiso = await this.permisoRepository.findOne({
      where: { id },
    });
    if (!existePermiso) {
      throw new Error(`El permiso con ID ${id} no existe`);
    }
    //2.- si existe, lo eliminamos
    await this.permisoRepository.delete(id);
  }

  async findByIds(ids: string[]): Promise<Permiso[]> {
    if (!ids.length) return [];
    const permisos = await this.permisoRepository.findBy({ id: In(ids) });
    if (permisos.length !== ids.length) {
      throw new ConflictException(
        `Algunos permisos no existen. IDs proporcionados: ${ids.join(', ')}`,
      );
    }
    return permisos;
  }

  async createMissing(permisosSeed: CrearPermisoDto[]): Promise<{
    creados: Permiso[];
    existentes: Permiso[];
  }> {
    if (!permisosSeed.length) return { creados: [], existentes: [] };

    const claves = permisosSeed.map((permiso) => permiso.clave);
    const existentes = await this.permisoRepository.find({
      where: { clave: In(claves) },
    });
    const clavesExistentes = new Set(
      existentes.map((permiso) => permiso.clave),
    );

    const permisosFaltantes = permisosSeed.filter(
      (permiso) => !clavesExistentes.has(permiso.clave),
    );
    const creados = permisosFaltantes.length
      ? await this.permisoRepository.save(
          this.permisoRepository.create(permisosFaltantes),
        )
      : [];

    return { creados, existentes };
  }

  //servicio para desactivar un permiso cambiar el estado
  async desactivar(id: string): Promise<Permiso> {
    //1.- primero verificamos que el permiso exista
    const existePermiso = await this.permisoRepository.findOne({
      where: { id },
    });
    if (!existePermiso) {
      throw new Error(`El permiso con ID ${id} no existe`);
    }
    //2.- si existe, lo desactivamos
    const estadoPermiso = !existePermiso.estado;
    const permisoDesactivado = this.permisoRepository.merge(existePermiso, {
      estado: estadoPermiso,
    });
    return await this.permisoRepository.save(permisoDesactivado);
  }
}
