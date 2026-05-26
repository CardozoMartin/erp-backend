import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PermisosService } from 'src/permisos/permisos.service';
import { In, Repository } from 'typeorm';
import { CrearRoleDto } from './dto/create-role.dto';
import { RoleSeed } from './roles-seed';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly permisosService: PermisosService,
  ) {}
  async create(createRoleDto: CrearRoleDto): Promise<Role> {
    //1.- primero verificamos que el rol no exista
    const existeRole = await this.roleRepository.findOne({
      where: { nombre: createRoleDto.nombre },
    });
    if (existeRole) {
      throw new ConflictException(
        `El rol con nombre ${createRoleDto.nombre} ya existe`,
      );
    }
    const permisos = await Promise.all(
      createRoleDto.permisosIds.map((permisoId) =>
        this.permisosService.findOne(permisoId),
      ),
    );

    const rol = this.roleRepository.create({
      nombre: createRoleDto.nombre,
      descripcion: createRoleDto.descripcion,
      rutaInicio: createRoleDto.rutaInicio,
      permisos,
    });
    return await this.roleRepository.save(rol);
  }
  //servicio para buscar un rol por su id
  async findByIds(ids: string[]): Promise<Role[]> {
    //1.- primero verificamos que el array de ids no esté vacío
    if (!ids.length) return [];
    //2.- buscamos los roles por sus ids
    const roles = await this.roleRepository.find({
      where: { id: In(ids) },
      relations: ['permisos'],
    });
    if (roles.length !== ids.length) {
      throw new ConflictException(
        `Algunos roles no existen. IDs proporcionados: ${ids.join(', ')}`,
      );
    }
    return roles;
  }

  //servicio para buscar un rol por id
  async findOne(id: string): Promise<Role> {
    const rol = await this.roleRepository.findOne({
      where: { id },
      relations: ['permisos'],
    });
    if (!rol) {
      throw new ConflictException(`El rol con ID ${id} no existe`);
    }
    return rol;
  }

  //servicio para buscar todos los roles
  async findAll(): Promise<Role[]> {
    return await this.roleRepository.find({ relations: ['permisos'] });
  }

  //servicio para actualizar un rol por su id
  async update(id: string, dto: UpdateRoleDto): Promise<Role> {
    const rol = await this.findOne(id);

    if (dto.nombre && dto.nombre !== rol.nombre) {
      const existe = await this.roleRepository.findOne({
        where: { nombre: dto.nombre },
      });
      if (existe)
        throw new ConflictException(
          `Ya existe un rol con el nombre "${dto.nombre}"`,
        );
    }

    if (dto.permisosIds) {
      rol.permisos = await this.permisosService.findByIds(dto.permisosIds);
    }

    if (dto.nombre) rol.nombre = dto.nombre;
    if (dto.descripcion !== undefined) rol.descripcion = dto.descripcion;
    if (dto.rutaInicio) rol.rutaInicio = dto.rutaInicio;

    return this.roleRepository.save(rol);
  }

  async remove(id: string): Promise<void> {
    const rol = await this.findOne(id);
    await this.roleRepository.remove(rol);
  }
  async toggleActivo(id: string): Promise<Role> {
    const rol = await this.findOne(id);
    rol.activo = !rol.activo;
    return this.roleRepository.save(rol);
  }

  async syncSeedRoles(seedRoles: RoleSeed[]): Promise<{
    creados: Role[];
    actualizados: Role[];
    sinCambios: Role[];
  }> {
    if (!seedRoles.length) {
      return { creados: [], actualizados: [], sinCambios: [] };
    }

    const permisos = await this.permisosService.findAll();
    const permisosPorClave = new Map(
      permisos.map((permiso) => [permiso.clave, permiso]),
    );

    const rolesExistentes = await this.roleRepository.find({
      relations: ['permisos'],
    });
    const rolesPorNombre = new Map(
      rolesExistentes.map((rol) => [rol.nombre, rol]),
    );

    const creados: Role[] = [];
    const actualizados: Role[] = [];
    const sinCambios: Role[] = [];

    for (const seedRole of seedRoles) {
      const permisosRol = seedRole.permisosClaves.map((clave) => {
        const permiso = permisosPorClave.get(clave);
        if (!permiso) {
          throw new ConflictException(
            `No existe el permiso con clave "${clave}" para el rol "${seedRole.nombre}"`,
          );
        }
        return permiso;
      });

      const existente = rolesPorNombre.get(seedRole.nombre);

      if (!existente) {
        const nuevoRol = this.roleRepository.create({
          nombre: seedRole.nombre,
          descripcion: seedRole.descripcion,
          rutaInicio: seedRole.rutaInicio,
          activo: true,
          permisos: permisosRol,
        });
        creados.push(await this.roleRepository.save(nuevoRol));
        continue;
      }

      const permisosActuales = [...existente.permisos]
        .map((permiso) => permiso.id)
        .sort();
      const permisosSeedIds = permisosRol.map((permiso) => permiso.id).sort();
      const mismosPermisos =
        permisosActuales.length === permisosSeedIds.length &&
        permisosActuales.every(
          (permisoId, index) => permisoId === permisosSeedIds[index],
        );

      const requiereActualizacion =
        existente.descripcion !== seedRole.descripcion ||
        existente.rutaInicio !== seedRole.rutaInicio ||
        existente.activo !== true ||
        !mismosPermisos;

      if (!requiereActualizacion) {
        sinCambios.push(existente);
        continue;
      }

      existente.descripcion = seedRole.descripcion;
      existente.rutaInicio = seedRole.rutaInicio;
      existente.activo = true;
      existente.permisos = permisosRol;

      actualizados.push(await this.roleRepository.save(existente));
    }

    return { creados, actualizados, sinCambios };
  }
}
