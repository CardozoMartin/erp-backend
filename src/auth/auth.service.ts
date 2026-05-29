// auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Empleado } from 'src/empleados/entities/empleado.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Empleado)
    private readonly empleadoRepo: Repository<Empleado>,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    // 1. Buscar empleado con roles y permisos
    const empleado = await this.empleadoRepo.findOne({
      where: { email },
      relations: [
        'empleadoRoles',
        'empleadoRoles.rol',
        'empleadoRoles.rol.permisos',
        'empleadoRoles.sucursal',
        'sucursales',
        'sucursales.sucursal',
      ],
    });

    if (!empleado) throw new UnauthorizedException('Credenciales inválidas');
    if (!empleado.activo) throw new UnauthorizedException('Empleado inactivo');

    // 2. Verificar contraseña
    const passwordValido = await bcrypt.compare(password, empleado.contrasena);
    if (!passwordValido)
      throw new UnauthorizedException('Credenciales inválidas');

    // 3. Calcular permisos únicos
    const permisos = [
      ...new Set(
        empleado.empleadoRoles
          .filter((er) => er.activo)
          .flatMap((er) => er.rol.permisos.map((p) => p.clave)),
      ),
    ];

    // 4. Calcular rutas habilitadas
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

    // 5. Sucursales asignadas
    const sucursales = empleado.sucursales
      .filter((es) => es.activo)
      .map((es) => ({
        id: es.sucursal.id,
        nombre: es.sucursal.nombre,
        esPrincipal: es.esSucursalPrincipal,
      }));

    // 6. Ruta de inicio (primer rol activo)
    const rutaInicio =
      empleado.empleadoRoles.filter((er) => er.activo)[0]?.rol.rutaInicio ??
      '/sin-acceso';

    // 7. Generar JWT
    const payload = {
      sub: empleado.id,
      email: empleado.email,
      permisos,
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
    };
  }

  async validarToken(payload: any) {
    const empleado = await this.empleadoRepo.findOne({
      where: { id: payload.sub, activo: true },
    });
    if (!empleado) throw new UnauthorizedException('Token inválido');
    return {
      id: empleado.id,
      email: empleado.email,
      permisos: payload.permisos,
    };
  }
}
