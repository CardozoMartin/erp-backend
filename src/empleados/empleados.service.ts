import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { RolesService } from 'src/roles/roles.service';
import { Repository } from 'typeorm';
import {
  AsignarRolesDto,
  CrearEmpleadoDto,
  RespuestaEmpleadoDto,
} from './dto/create-empleado.dto';
import { UpdateEmpleadoDto } from './dto/update-empleado.dto';
import { EmpleadoSucursalesService } from './empleado-sucursales.service';
import { EmpleadoRol } from './entities/empleado-rol.entity';
import { Empleado } from './entities/empleado.entity';

@Injectable()
export class EmpleadosService {
  constructor(
    @InjectRepository(Empleado)
    private readonly empleadosRepo: Repository<Empleado>,
    @InjectRepository(EmpleadoRol)
    private readonly empleadoRolRepo: Repository<EmpleadoRol>,
    private readonly rolesService: RolesService,
    private readonly empleadoSucursalesService: EmpleadoSucursalesService,
  ) {}
  async create(
    createEmpleadoDto: CrearEmpleadoDto,
  ): Promise<RespuestaEmpleadoDto> {
    //1.- validamos que no exista el empleado por email
    const empladoExiste = await this.empleadosRepo.findOne({
      where: { email: createEmpleadoDto.email },
    });
    if (empladoExiste) {
      throw new ConflictException(
        `El email ${createEmpleadoDto.email} ya está registrado`,
      );
    }

    const roles = createEmpleadoDto.rolesIds?.length
      ? await this.rolesService.findByIds(createEmpleadoDto.rolesIds)
      : [];

    //hasheamos la contraseña
    const contraseñaHash = await bcrypt.hash(createEmpleadoDto.contrasena, 10);

    const nuevoEmpleado = this.empleadosRepo.create({
      nombreCompleto: createEmpleadoDto.nombreCompleto,
      email: createEmpleadoDto.email,
      contrasena: contraseñaHash,
      telefono: createEmpleadoDto.telefono,
      direccion: createEmpleadoDto.direccion,
      cargo: createEmpleadoDto.cargo,
      foto_url: createEmpleadoDto.foto_url,
    });
    const empleadoGuardado = await this.empleadosRepo.save(nuevoEmpleado);

    if (roles.length) {
      //creamos las relaciones con roles
      const empleadoRoles = roles.map((rol) =>
        this.empleadoRolRepo.create({
          empleado: empleadoGuardado,
          rol,
        }),
      );
      await this.empleadoRolRepo.save(empleadoRoles);
    }
    // Sucursal
    if (createEmpleadoDto.sucursalId) {
      await this.empleadoSucursalesService.asignar(
        empleadoGuardado.id,
        createEmpleadoDto.sucursalId,
        createEmpleadoDto.esSucursalPrincipal ?? true,
      );
    }

    const empleadoCompleto = await this.cargarEmpleadoCompleto(
      empleadoGuardado.id,
    );
    return this.buildRespuesta(empleadoCompleto);
  }

  async findAll(page: number = 1, limit: number = 30) {
    const [empleados, total] = await this.empleadosRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      relations: [
        'empleadoRoles',
        'empleadoRoles.rol',
        'sucursales',
        'sucursales.sucursal',
      ],
    });
    return {
      data: empleados.map((e) => this.buildRespuesta(e)),
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  findOne(id: string) {
    return `This action returns a #${id} empleado`;
  }

  async update(
    id: string,
    updateEmpleadoDto: UpdateEmpleadoDto,
  ): Promise<RespuestaEmpleadoDto> {
    const empleado = await this.empleadosRepo.findOne({ where: { id } });
    if (!empleado) {
      throw new NotFoundException(`Empleado ${id} no encontrado`);
    }

    const { rolesIds, sucursalId, esSucursalPrincipal, ...empleadoData } =
      updateEmpleadoDto;

    if (updateEmpleadoDto.contrasena) {
      empleadoData.contrasena = await bcrypt.hash(
        updateEmpleadoDto.contrasena,
        10,
      );
    }

    const empleadoActualizado = this.empleadosRepo.merge(empleado, empleadoData);
    await this.empleadosRepo.save(empleadoActualizado);

    if (rolesIds?.length) {
      return this.asignarRoles(id, { rolesIds });
    }

    if (sucursalId) {
      await this.empleadoSucursalesService.asignar(
        id,
        sucursalId,
        esSucursalPrincipal ?? true,
      );
    }

    const empleadoCompleto = await this.cargarEmpleadoCompleto(id);
    return this.buildRespuesta(empleadoCompleto);
  }

  remove(id: string) {
    return `This action removes a #${id} empleado`;
  }

  async asignarRoles(
    id: string,
    asignarRolesDto: AsignarRolesDto,
  ): Promise<RespuestaEmpleadoDto> {
    const empleado = await this.cargarEmpleadoCompleto(id);
    const roles = await this.rolesService.findByIds(asignarRolesDto.rolesIds);

    if (empleado.empleadoRoles.length > 0) {
      await this.empleadoRolRepo.remove(empleado.empleadoRoles);
    }

    const empleadoRoles = roles.map((rol) =>
      this.empleadoRolRepo.create({
        empleado,
        rol,
      }),
    );
    await this.empleadoRolRepo.save(empleadoRoles);

    const empleadoActualizado = await this.cargarEmpleadoCompleto(id);
    return this.buildRespuesta(empleadoActualizado);
  }

  //Helpers
  private buildRespuesta(empleado: Empleado): RespuestaEmpleadoDto {
    const roles = empleado.empleadoRoles.map((er) => ({
      id: er.rol.id,
      nombre: er.rol.nombre,
      rutaInicio: er.rol.rutaInicio,
    }));

    const permisos = [
      ...new Set(
        empleado.empleadoRoles.flatMap((er) =>
          er.rol.permisos.map((p) => p.clave),
        ),
      ),
    ];

    // ← NUEVO
    const sucursales =
      empleado.sucursales?.map((es) => ({
        id: es.sucursal.id,
        nombre: es.sucursal.nombre,
        esPrincipal: es.esSucursalPrincipal,
        activo: es.activo,
      })) ?? [];

    return {
      id: empleado.id,
      nombreCompleto: empleado.nombreCompleto,
      email: empleado.email,
      telefono: empleado.telefono,
      direccion: empleado.direccion,
      cargo: empleado.cargo,
      foto_url: empleado.foto_url,
      activo: empleado.activo,
      roles,
      permisos,
      sucursales, // ← nuevo
    };
  }

  private async cargarEmpleadoCompleto(id: string): Promise<Empleado> {
    const empleado = await this.empleadosRepo.findOne({
      where: { id },
      relations: [
        'empleadoRoles',
        'empleadoRoles.rol',
        'empleadoRoles.rol.permisos',
        'sucursales', // ← nuevo
        'sucursales.sucursal', // ← nuevo
      ],
    });
    if (!empleado) throw new NotFoundException(`Empleado ${id} no encontrado`);
    return empleado;
  }
}
