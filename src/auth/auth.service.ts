// auth/auth.service.ts
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Empleado } from 'src/empleados/entities/empleado.entity';
import { EmpleadoSucursal } from 'src/empleados/entities/empleado-sucursal.entity';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { frontRoutes } from './front-routes';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import { SesionActiva } from './entities/sesion-activa.entity';

// Duración del access token: 15 minutos
const ACCESS_TOKEN_TTL = '15m';
// Duración del refresh token: 30 días
const REFRESH_TOKEN_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Empleado)
    private readonly empleadoRepo: Repository<Empleado>,
    @InjectRepository(EmpleadoSucursal)
    private readonly empleadoSucursalRepo: Repository<EmpleadoSucursal>,
    @InjectRepository(SesionActiva)
    private readonly sesionRepo: Repository<SesionActiva>,
    private readonly jwtService: JwtService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  private generarRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async crearSesion(empleadoId: string, sucursalId: string | null): Promise<string> {
    const refreshToken = this.generarRefreshToken();
    const expiraEn = new Date();
    expiraEn.setDate(expiraEn.getDate() + REFRESH_TOKEN_DAYS);

    const sesion = this.sesionRepo.create({
      refresh_token: refreshToken,
      empleado_id: empleadoId,
      sucursal_id: sucursalId,
      expira_en: expiraEn,
      revocado: false,
    });
    await this.sesionRepo.save(sesion);
    return refreshToken;
  }

  private calcularPermisos(empleado: Empleado): string[] {
    const permisos = new Set(
      empleado.empleadoRoles
        ?.filter((er) => er.activo)
        .flatMap((er) => er.rol.permisos.map((p) => p.clave)) ?? [],
    );

    empleado.permisosExtra
      ?.filter((extra) => extra.tipo === 'grant')
      .forEach((extra) => permisos.add(extra.permiso.clave));

    empleado.permisosExtra
      ?.filter((extra) => extra.tipo === 'revoke')
      .forEach((extra) => permisos.delete(extra.permiso.clave));

    return [...permisos];
  }

  private calcularRutasPermitidas(permisos: string[]) {
    const permisosSet = new Set(permisos);
    return frontRoutes
      .filter((route) =>
        route.requiredAny.some((permiso) => permisosSet.has(permiso)),
      )
      .map(({ path, label }) => ({ path, label }));
  }

  private resolverRutaInicio(
    empleado: Empleado,
    rutas: Array<{ path: string; label: string }>,
  ) {
    const rutasSet = new Set(rutas.map((ruta) => ruta.path));
    const rutaRol = empleado.empleadoRoles
      ?.filter((er) => er.activo)
      .map((er) => er.rol.rutaInicio)
      .find((ruta) => rutasSet.has(ruta));

    return rutaRol ?? rutas[0]?.path ?? '/sin-acceso';
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

    const rutas = this.calcularRutasPermitidas(permisos);

    const sucursales = empleado.sucursales
      .filter((es) => es.activo)
      .map((es) => ({
        id: es.sucursal.id,
        nombre: es.sucursal.nombre,
        esPrincipal: es.esSucursalPrincipal,
      }));
    const sucursalId = this.resolverSucursalActiva(empleado.sucursales);

    const rutaInicio = this.resolverRutaInicio(empleado, rutas);

    const payload = {
      sub: empleado.id,
      email: empleado.email,
      permisos,
      sucursalId,
    };

    const token = this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_TTL });
    const refreshToken = await this.crearSesion(empleado.id, sucursalId);

    await this.auditoriaService.registrar({
      modulo: 'auth',
      accion: 'LOGIN',
      entidad: 'empleado',
      entidad_id: empleado.id,
      empleado_id: empleado.id,
      sucursal_id: sucursalId,
      descripcion: `Inicio de sesion de ${empleado.email}`,
      metadata: { email: empleado.email },
    });

    return {
      token,
      refreshToken,
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

  async refresh(refreshToken: string) {
    const sesion = await this.sesionRepo.findOne({
      where: {
        refresh_token: refreshToken,
        revocado: false,
        expira_en: MoreThan(new Date()),
      },
      relations: ['empleado', 'empleado.empleadoRoles', 'empleado.empleadoRoles.rol', 'empleado.empleadoRoles.rol.permisos', 'empleado.permisosExtra', 'empleado.permisosExtra.permiso'],
    });

    if (!sesion) throw new UnauthorizedException('Sesión inválida o expirada');
    if (!sesion.empleado.activo) throw new UnauthorizedException('Empleado inactivo');

    const permisos = this.calcularPermisos(sesion.empleado);
    const rutas = this.calcularRutasPermitidas(permisos);
    const rutaInicio = this.resolverRutaInicio(sesion.empleado, rutas);

    const payload = {
      sub: sesion.empleado_id,
      email: sesion.empleado.email,
      permisos,
      sucursalId: sesion.sucursal_id,
    };

    // Rotar el refresh token — invalida el anterior y emite uno nuevo
    sesion.revocado = true;
    await this.sesionRepo.save(sesion);
    const nuevoRefreshToken = await this.crearSesion(sesion.empleado_id, sesion.sucursal_id);

    return {
      token: this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_TTL }),
      refreshToken: nuevoRefreshToken,
      permisos,
      rutas,
      rutaInicio,
    };
  }

  async validarToken(payload: JwtPayload) {
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
        'permisosExtra',
        'permisosExtra.permiso',
      ],
    });
    if (!empleado) throw new UnauthorizedException('Empleado no encontrado');

    const permisos = this.calcularPermisos(empleado);
    const rutas = this.calcularRutasPermitidas(permisos);
    const rutaInicio = this.resolverRutaInicio(empleado, rutas);

    const payload = {
      sub: empleado.id,
      email: empleado.email,
      permisos,
      sucursalId,
    };

    const nuevoRefreshToken = await this.crearSesion(empleadoId, sucursalId);

    return {
      token: this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_TTL }),
      refreshToken: nuevoRefreshToken,
      sucursal: {
        id: asignacion.sucursal.id,
        nombre: asignacion.sucursal.nombre,
      },
      permisos,
      rutas,
      rutaInicio,
    };
  }

  async logout(empleadoId: string, sucursalId?: string | null, refreshToken?: string) {
    if (refreshToken) {
      await this.sesionRepo.update(
        { refresh_token: refreshToken, empleado_id: empleadoId },
        { revocado: true },
      );
    } else {
      // Sin refresh token: revocar todas las sesiones activas del empleado
      await this.sesionRepo.update(
        { empleado_id: empleadoId, revocado: false },
        { revocado: true },
      );
    }

    await this.auditoriaService.registrar({
      modulo: 'auth',
      accion: 'LOGOUT',
      entidad: 'empleado',
      entidad_id: empleadoId,
      empleado_id: empleadoId,
      sucursal_id: sucursalId ?? null,
      descripcion: 'Cierre de sesion',
    });
    return { ok: true };
  }

  async limpiarSesionesExpiradas(): Promise<void> {
    await this.sesionRepo.delete({
      expira_en: LessThan(new Date()),
    });
  }
}
