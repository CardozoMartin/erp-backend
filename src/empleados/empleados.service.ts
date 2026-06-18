import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import {
  Comprobante,
  EstadoComprobante,
  TipoComprobante,
} from 'src/comprobantes/entities/comprobante.entity';
import { RolesService } from 'src/roles/roles.service';
import { Between, In, Repository } from 'typeorm';
import {
  AsignarRolesDto,
  CrearEmpleadoDto,
  RespuestaEmpleadoDto,
} from './dto/create-empleado.dto';
import { UpdateEmpleadoDto } from './dto/update-empleado.dto';
import { EmpleadoSucursalesService } from './empleado-sucursales.service';
import { EmpleadoRol } from './entities/empleado-rol.entity';
import { Empleado } from './entities/empleado.entity';
import { EmpleadoPermiso } from './entities/empleado-permiso.entity';
import { AsignarPermisoDto, RemoverPermisoDto } from './dto/empleado-permiso.dto';

@Injectable()
export class EmpleadosService {
  constructor(
    @InjectRepository(Empleado)
    private readonly empleadosRepo: Repository<Empleado>,
    @InjectRepository(EmpleadoRol)
    private readonly empleadoRolRepo: Repository<EmpleadoRol>,
    @InjectRepository(EmpleadoPermiso)
    private readonly empleadoPermisoRepo: Repository<EmpleadoPermiso>,
    @InjectRepository(Comprobante)
    private readonly comprobanteRepo: Repository<Comprobante>,
    private readonly rolesService: RolesService,
    private readonly empleadoSucursalesService: EmpleadoSucursalesService,
    private readonly auditoriaService: AuditoriaService,
  ) {}
  async create(
    createEmpleadoDto: CrearEmpleadoDto,
    empleadoActorId?: string | null,
    sucursalId?: string | null,
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
      bono_ventas_activo: createEmpleadoDto.bono_ventas_activo ?? false,
      meta_mensual_ventas: Number(createEmpleadoDto.meta_mensual_ventas ?? 0),
      bono_mensual_ventas: Number(createEmpleadoDto.bono_mensual_ventas ?? 0),
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
    const respuesta = this.buildRespuesta(empleadoCompleto);
    await this.auditoriaService.registrar({
      modulo: 'empleados',
      accion: 'CREAR_EMPLEADO',
      entidad: 'empleado',
      entidad_id: respuesta.id,
      empleado_id: empleadoActorId ?? null,
      sucursal_id: sucursalId ?? createEmpleadoDto.sucursalId ?? null,
      descripcion: `Empleado creado: ${respuesta.nombreCompleto}`,
      despues: respuesta as any,
    });
    return respuesta;
  }

  async findAll(sucursalId: string, page: number = 1, limit: number = 30) {
    const [empleados, total] = await this.empleadosRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      relations: [
        'empleadoRoles',
        'empleadoRoles.rol',
        'sucursales',
        'sucursales.sucursal',
      ],
      where: {
        sucursales: { sucursal: { id: sucursalId } },
      },
    });
    const ventasPorEmpleado = await this.calcularVentasMesActual(
      empleados.map((empleado) => empleado.id),
    );
    return {
      data: empleados.map((e) => this.buildRespuesta(e, ventasPorEmpleado.get(e.id) ?? 0)),
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async findByEmail(email: string) {
    return this.empleadosRepo.findOne({ where: { email } });
  }

  findOne(id: string) {
    return `This action returns a #${id} empleado`;
  }

  async update(
    id: string,
    updateEmpleadoDto: UpdateEmpleadoDto,
    empleadoActorId?: string | null,
    sucursalActivaId?: string | null,
  ): Promise<RespuestaEmpleadoDto> {
    const empleado = await this.cargarEmpleadoCompleto(id);
    if (!empleado) {
      throw new NotFoundException(`Empleado ${id} no encontrado`);
    }
    const antes = this.buildRespuesta(empleado);

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
      return this.asignarRoles(
        id,
        { rolesIds },
        empleadoActorId,
        sucursalActivaId,
        antes,
      );
    }

    if (sucursalId) {
      await this.empleadoSucursalesService.asignar(
        id,
        sucursalId,
        esSucursalPrincipal ?? true,
      );
    }

    const empleadoCompleto = await this.cargarEmpleadoCompleto(id);
    const ventasMes = await this.calcularVentasEmpleadoMesActual(empleadoCompleto.id);
    const respuesta = this.buildRespuesta(empleadoCompleto, ventasMes);
    await this.auditoriaService.registrar({
      modulo: 'empleados',
      accion: 'ACTUALIZAR_EMPLEADO',
      entidad: 'empleado',
      entidad_id: id,
      empleado_id: empleadoActorId ?? null,
      sucursal_id: sucursalActivaId ?? sucursalId ?? null,
      descripcion: `Empleado actualizado: ${respuesta.nombreCompleto}`,
      antes: antes as any,
      despues: respuesta as any,
      metadata: { campos_recibidos: Object.keys(updateEmpleadoDto) },
    });
    return respuesta;
  }

  remove(id: string) {
    return `This action removes a #${id} empleado`;
  }

  async resetPassword(
    id: string,
    actorId?: string | null,
    sucursalActivaId?: string | null,
  ): Promise<{ mensaje: string; contrasenaGenerada: string }> {
    const empleado = await this.cargarEmpleadoCompleto(id);

    const caracteres = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
    const contrasenaGenerada = Array.from({ length: 12 }, () =>
      caracteres[Math.floor(Math.random() * caracteres.length)],
    ).join('');

    empleado.contrasena = await bcrypt.hash(contrasenaGenerada, 10);
    await this.empleadosRepo.save(empleado);

    await this.auditoriaService.registrar({
      modulo: 'empleados',
      accion: 'RESET_PASSWORD',
      entidad: 'empleado',
      entidad_id: id,
      empleado_id: actorId ?? null,
      sucursal_id: sucursalActivaId ?? null,
      descripcion: `Contraseña reseteada para: ${empleado.nombreCompleto}`,
    });

    return { mensaje: 'Contraseña reseteada correctamente', contrasenaGenerada };
  }

  async asignarRoles(
    id: string,
    asignarRolesDto: AsignarRolesDto,
    empleadoActorId?: string | null,
    sucursalId?: string | null,
    antesYaCargado?: RespuestaEmpleadoDto,
  ): Promise<RespuestaEmpleadoDto> {
    const empleado = await this.cargarEmpleadoCompleto(id);
    const antes = antesYaCargado ?? this.buildRespuesta(empleado);
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
    const ventasMes = await this.calcularVentasEmpleadoMesActual(empleadoActualizado.id);
    const respuesta = this.buildRespuesta(empleadoActualizado, ventasMes);
    await this.auditoriaService.registrar({
      modulo: 'empleados',
      accion: 'ACTUALIZAR_ROLES_EMPLEADO',
      entidad: 'empleado',
      entidad_id: id,
      empleado_id: empleadoActorId ?? null,
      sucursal_id: sucursalId ?? null,
      descripcion: `Roles actualizados: ${respuesta.nombreCompleto}`,
      antes: antes as any,
      despues: respuesta as any,
    });
    return respuesta;
  }

  async asignarPermisoExtra(
    id: string,
    dto: AsignarPermisoDto,
    actorId?: string | null,
    sucursalActivaId?: string | null,
  ): Promise<RespuestaEmpleadoDto> {
    const empleado = await this.cargarEmpleadoCompleto(id);
    if (!empleado) throw new NotFoundException(`Empleado ${id} no encontrado`);
    const antes = this.buildRespuesta(empleado);

    if (!sucursalActivaId) {
      throw new ConflictException('Se requiere una sucursal activa para asignar permisos específicos');
    }

    const permisoExistente = await this.empleadoPermisoRepo.findOne({
      where: {
        empleado: { id },
        permiso: { id: dto.permisoId },
        sucursal: { id: sucursalActivaId },
      },
    });

    if (permisoExistente) {
      permisoExistente.tipo = dto.tipo;
      await this.empleadoPermisoRepo.save(permisoExistente);
    } else {
      const nuevoPermiso = this.empleadoPermisoRepo.create({
        empleado: { id },
        permiso: { id: dto.permisoId } as any,
        sucursal: { id: sucursalActivaId } as any,
        tipo: dto.tipo,
      });
      await this.empleadoPermisoRepo.save(nuevoPermiso);
    }

    const empleadoActualizado = await this.cargarEmpleadoCompleto(id);
    const ventasMes = await this.calcularVentasEmpleadoMesActual(id);
    const respuesta = this.buildRespuesta(empleadoActualizado, ventasMes);

    await this.auditoriaService.registrar({
      modulo: 'empleados',
      accion: 'ASIGNAR_PERMISO_EXTRA',
      entidad: 'empleado',
      entidad_id: id,
      empleado_id: actorId ?? null,
      sucursal_id: sucursalActivaId ?? null,
      descripcion: `Se asignó el permiso ${dto.permisoId} (${dto.tipo}) a ${respuesta.nombreCompleto}`,
      antes: antes as any,
      despues: respuesta as any,
    });

    return respuesta;
  }

  async removerPermisoExtra(
    id: string,
    permisoId: string,
    actorId?: string | null,
    sucursalActivaId?: string | null,
  ): Promise<RespuestaEmpleadoDto> {
    const empleado = await this.cargarEmpleadoCompleto(id);
    if (!empleado) throw new NotFoundException(`Empleado ${id} no encontrado`);
    const antes = this.buildRespuesta(empleado);

    if (!sucursalActivaId) {
      throw new ConflictException('Se requiere una sucursal activa para remover permisos específicos');
    }

    const permisoExistente = await this.empleadoPermisoRepo.findOne({
      where: {
        empleado: { id },
        permiso: { id: permisoId },
        sucursal: { id: sucursalActivaId },
      },
    });

    if (permisoExistente) {
      await this.empleadoPermisoRepo.remove(permisoExistente);
    }

    const empleadoActualizado = await this.cargarEmpleadoCompleto(id);
    const ventasMes = await this.calcularVentasEmpleadoMesActual(id);
    const respuesta = this.buildRespuesta(empleadoActualizado, ventasMes);

    await this.auditoriaService.registrar({
      modulo: 'empleados',
      accion: 'REMOVER_PERMISO_EXTRA',
      entidad: 'empleado',
      entidad_id: id,
      empleado_id: actorId ?? null,
      sucursal_id: sucursalActivaId ?? null,
      descripcion: `Se removió el permiso ${permisoId} a ${respuesta.nombreCompleto}`,
      antes: antes as any,
      despues: respuesta as any,
    });

    return respuesta;
  }

  //Helpers
  private buildRespuesta(empleado: Empleado, ventasMesActual = 0): RespuestaEmpleadoDto {
    const roles = empleado.empleadoRoles.map((er) => ({
      id: er.rol.id,
      nombre: er.rol.nombre,
      rutaInicio: er.rol.rutaInicio,
    }));

    const permisosSet = new Set(
      empleado.empleadoRoles.flatMap((er) =>
        er.rol.permisos.map((p) => p.clave),
      ),
    );

    empleado.permisosExtra
      ?.filter((extra) => extra.tipo === 'grant')
      .forEach((extra) => permisosSet.add(extra.permiso.clave));

    empleado.permisosExtra
      ?.filter((extra) => extra.tipo === 'revoke')
      .forEach((extra) => permisosSet.delete(extra.permiso.clave));

    const permisos = [...permisosSet];

    const permisosExtra = empleado.permisosExtra?.map(pe => ({
      permiso: {
        id: pe.permiso.id,
        clave: pe.permiso.clave,
        nombre: pe.permiso.nombre,
        modulo: pe.permiso.modulo,
      },
      tipo: pe.tipo,
      sucursalId: pe.sucursal.id,
    })) ?? [];

    // ← NUEVO
    const sucursales =
      empleado.sucursales?.map((es) => ({
        id: es.sucursal.id,
        nombre: es.sucursal.nombre,
        esPrincipal: es.esSucursalPrincipal,
        activo: es.activo,
      })) ?? [];

    const metaMensual = Number(empleado.meta_mensual_ventas ?? 0);
    const bonoActivo = empleado.bono_ventas_activo === true;
    const avance = bonoActivo && metaMensual > 0 ? (ventasMesActual / metaMensual) * 100 : 0;

    return {
      id: empleado.id,
      nombreCompleto: empleado.nombreCompleto,
      email: empleado.email,
      telefono: empleado.telefono,
      direccion: empleado.direccion,
      cargo: empleado.cargo,
      foto_url: empleado.foto_url,
      activo: empleado.activo,
      bono_ventas_activo: bonoActivo,
      meta_mensual_ventas: metaMensual,
      bono_mensual_ventas: Number(empleado.bono_mensual_ventas ?? 0),
      ventas_mes_actual: Number(ventasMesActual.toFixed(2)),
      avance_bono_ventas: Number(avance.toFixed(2)),
      bono_ventas_corresponde: bonoActivo && metaMensual > 0 && ventasMesActual >= metaMensual,
      roles,
      permisos,
      permisosExtra,
      sucursales, // ← nuevo
    };
  }

  private async calcularVentasEmpleadoMesActual(empleadoId: string): Promise<number> {
    const ventas = await this.calcularVentasMesActual([empleadoId]);
    return ventas.get(empleadoId) ?? 0;
  }

  private async calcularVentasMesActual(empleadoIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (!empleadoIds.length) return result;

    const now = new Date();
    const desde = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const hasta = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const ventas = await this.comprobanteRepo.find({
      where: {
        tipo: TipoComprobante.VENTA,
        empleado_vendedor_id: In(empleadoIds),
        estado: In([
          EstadoComprobante.PENDIENTE_COBRO,
          EstadoComprobante.COBRADA,
          EstadoComprobante.ENTREGADO_PARCIAL,
          EstadoComprobante.ENTREGADO,
        ]),
        created_at: Between(desde, hasta),
      },
    });

    for (const venta of ventas) {
      if (!venta.empleado_vendedor_id) continue;
      result.set(
        venta.empleado_vendedor_id,
        (result.get(venta.empleado_vendedor_id) ?? 0) + Number(venta.total ?? 0),
      );
    }
    return result;
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
        'permisosExtra',
        'permisosExtra.permiso',
        'permisosExtra.sucursal',
      ],
    });
    if (!empleado) throw new NotFoundException(`Empleado ${id} no encontrado`);
    return empleado;
  }
}
