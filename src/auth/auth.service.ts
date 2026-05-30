// auth/auth.service.ts
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Empleado } from 'src/empleados/entities/empleado.entity';
import { EmpleadoSucursal } from 'src/empleados/entities/empleado-sucursal.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Empleado)
    private readonly empleadoRepo: Repository<Empleado>,
    @InjectRepository(EmpleadoSucursal)
    private readonly empleadoSucursalRepo: Repository<EmpleadoSucursal>,
    private readonly jwtService: JwtService,
  ) {}

  private calcularPermisos(empleado: Empleado): string[] {
    return [
      ...new Set(
        empleado.empleadoRoles
          ?.filter((er) => er.activo)
          .flatMap((er) => er.rol.permisos.map((p) => p.clave)) ?? [],
      ),
    ];
  }

  private resolverSucursalActiva(
    sucursales: EmpleadoSucursal[],
  ): string | null {
    const activas = sucursales.filter((es) => es.activo);
    const principal = activas.find((es) => es.esSucursalPrincipal);
    return principal?.sucursal.id ?? activas[0]?.sucursal.id ?? null;
  }

  async login(email: string, password: string) {
    const empleado = await this.empleadoRepo.findOne({
      where: { email },
      relations: [
        'sucursales',
        'sucursales.sucursal',
        'empleadoRoles',
        'empleadoRoles.rol',
        'empleadoRoles.rol.permisos',
        'permisosExtra',
        'permisosExtra.permiso',
      ],
    });

    if (!empleado) throw new UnauthorizedException('Credenciales invalidas');
    if (!empleado.activo) throw new UnauthorizedException('Empleado inactivo');

    const passwordValido = await bcrypt.compare(password, empleado.contrasena);
    if (!passwordValido) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const permisos = this.calcularPermisos(empleado);

    const rutas = [
      ...new Map(
        empleado.empleadoRoles
          .filter((er) => er.activo)
          .map((er) => [
            er.rol.rutaInicio,
            {
              path: er.rol.rutaInicio,
              label: er.rol.nombre,
            },
          ]),
      ).values(),
    ];

    const sucursales = empleado.sucursales
      .filter((es) => es.activo)
      .map((es) => ({
        id: es.sucursal.id,
        nombre: es.sucursal.nombre,
        esPrincipal: es.esSucursalPrincipal,
      }));
    const sucursalId = this.resolverSucursalActiva(empleado.sucursales);

    const rutaInicio =
      empleado.empleadoRoles.filter((er) => er.activo)[0]?.rol.rutaInicio ??
      '/sin-acceso';

    const payload = {
      sub: empleado.id,
      email: empleado.email,
      permisos,
      sucursalId,
    };

    const token = this.jwtService.sign(payload);

    return {
      token,
      empleado: {
        id: empleado.id,
        nombreCompleto: empleado.nombreCompleto,
        email: empleado.email,
        cargo: empleado.cargo,
        foto_url: empleado.foto_url,
      },
      permisos,
      rutas,
      rutaInicio,
      sucursales,
      sucursalActivaId: sucursalId,
    };
  }

  async validarToken(payload: any) {
    const empleado = await this.empleadoRepo.findOne({
      where: { id: payload.sub, activo: true },
    });
    if (!empleado) throw new UnauthorizedException('Token invalido');

    if (payload.sucursalId) {
      const asignacion = await this.empleadoSucursalRepo.findOne({
        where: {
          empleado: { id: payload.sub },
          sucursal: { id: payload.sucursalId },
          activo: true,
        },
      });
      if (!asignacion) {
        throw new ForbiddenException('No tenes acceso a esa sucursal');
      }
    }

    return {
      id: empleado.id,
      sub: empleado.id,
      email: empleado.email,
      permisos: payload.permisos,
      sucursalId: payload.sucursalId ?? null,
    };
  }

  async seleccionarSucursal(empleadoId: string, sucursalId: string) {
    const asignacion = await this.empleadoSucursalRepo.findOne({
      where: {
        empleado: { id: empleadoId },
        sucursal: { id: sucursalId },
        activo: true,
      },
      relations: ['sucursal'],
    });

    if (!asignacion) {
      throw new ForbiddenException('No tenes acceso a esa sucursal');
    }

    const empleado = await this.empleadoRepo.findOne({
      where: { id: empleadoId },
      relations: [
        'empleadoRoles',
        'empleadoRoles.rol',
        'empleadoRoles.rol.permisos',
      ],
    });
    if (!empleado) throw new UnauthorizedException('Empleado no encontrado');

    const permisos = this.calcularPermisos(empleado);

    const payload = {
      sub: empleado.id,
      email: empleado.email,
      permisos,
      sucursalId,
    };

    return {
      token: this.jwtService.sign(payload),
      sucursal: {
        id: asignacion.sucursal.id,
        nombre: asignacion.sucursal.nombre,
      },
    };
  }
}
