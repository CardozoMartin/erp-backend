import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PagosModuleService } from 'src/pagos-module/pagos-module.service';
import { CrearMedioPagoDto } from 'src/pagos-module/dto/create-pagos-module.dto';
import {
  MedioPago,
  TipoMedioPago,
} from 'src/pagos-module/entities/medio-pago.entity';
import { PermisosSeedService } from 'src/permisos/permisos-seed.service';
import { rolesSeed } from 'src/roles/roles-seed';
import { RolesService } from 'src/roles/roles.service';
import { CrearEmpleadoDto } from 'src/empleados/dto/create-empleado.dto';
import { EmpleadosService } from 'src/empleados/empleados.service';
import { Empleado } from 'src/empleados/entities/empleado.entity';

const mediosPagoSeed: CrearMedioPagoDto[] = [
  {
    nombre: 'Efectivo',
    tipo: TipoMedioPago.EFECTIVO,
    requiereReferencia: false,
  },
  {
    nombre: 'Tarjeta Debito',
    tipo: TipoMedioPago.TARJETA,
    requiereReferencia: false,
  },
  {
    nombre: 'Tarjeta Credito',
    tipo: TipoMedioPago.TARJETA,
    requiereReferencia: false,
  },
  {
    nombre: 'Transferencia',
    tipo: TipoMedioPago.TRANSFERENCIA,
    requiereReferencia: true,
  },
  {
    nombre: 'MercadoPago QR',
    tipo: TipoMedioPago.QR,
    requiereReferencia: false,
  },
];

type SeedResult = {
  permisos: {
    creados: number;
    existentes: number;
  };
  mediosPago: {
    creados: number;
    existentes: number;
  };
  roles: {
    creados: number;
    actualizados: number;
    sinCambios: number;
  };
  empleadosSeed: {
    creados: number;
    existentes: number;
    rolAsignados: number;
  };
};

type EmpleadoSeed = {
  nombreCompleto: string;
  email: string;
  contrasena: string;
  telefono: string;
  direccion: string;
  cargo: string;
  roleName: string;
};

const empleadosSeed: EmpleadoSeed[] = [
  {
    nombreCompleto: 'Vendedor',
    email: 'vendedor@gmail.com',
    contrasena: 'vendedor',
    telefono: '0000000000',
    direccion: 'Oficina Principal',
    cargo: 'Vendedor',
    roleName: 'Vendedor',
  },
  {
    nombreCompleto: 'Cajero',
    email: 'cajero@gmail.com',
    contrasena: 'cajero',
    telefono: '0000000000',
    direccion: 'Oficina Principal',
    cargo: 'Cajero',
    roleName: 'Cajero',
  },
  {
    nombreCompleto: 'Vendedor Cajero',
    email: 'cajerovendedor@gmail.com',
    contrasena: 'cajerovendedor',
    telefono: '0000000000',
    direccion: 'Oficina Principal',
    cargo: 'Vendedor Cajero',
    roleName: 'Vendedor Cajero',
  },
];

@Injectable()
export class AppSeedService {
  private readonly logger = new Logger(AppSeedService.name);

  constructor(
    private readonly permisosSeedService: PermisosSeedService,
    private readonly pagosService: PagosModuleService,
    private readonly rolesService: RolesService,
    private readonly empleadosService: EmpleadosService,
    @InjectRepository(Empleado)
    private readonly empleadosRepo: Repository<Empleado>,
  ) {}

  async seedInitialData(logResults = true): Promise<SeedResult> {
    const permisosSeedResult =
      await this.permisosSeedService.seedDefaultPermissions();

    const existentesPagos = await this.pagosService.findAll();
    const nombresExistentes = new Set(
      existentesPagos.map((medio) => medio.nombre.toLowerCase()),
    );
    const mediosFaltantes = mediosPagoSeed.filter(
      (medio) => !nombresExistentes.has(medio.nombre.toLowerCase()),
    );

    const creadosPagos: MedioPago[] = [];
    for (const medio of mediosFaltantes) {
      const creado = await this.pagosService.create(medio);
      creadosPagos.push(creado);
    }

    const rolesResult = await this.rolesService.syncSeedRoles(rolesSeed);
    await this.seedAdminUser(logResults);

    const rolesPorNombre = new Map(
      [...rolesResult.creados, ...rolesResult.actualizados, ...rolesResult.sinCambios].map(
        (rol) => [rol.nombre, rol],
      ),
    );

    const adminRole = rolesPorNombre.get('Admin');
    if (!adminRole) {
      throw new Error('No se encontró el rol Admin luego del seed de roles');
    }

    const seededEmpleados = [
      {
        nombreCompleto: 'Administrador',
        email: 'martin@gmail.com',
        contrasena: 'Holamundo123!',
        telefono: '0000000000',
        direccion: 'Oficina Principal',
        cargo: 'Admin',
        rolesIds: [adminRole.id],
      },
    ];

    for (const empleado of empleadosSeed) {
      const role = rolesPorNombre.get(empleado.roleName);
      if (!role) {
        throw new Error(`No se encontró el rol ${empleado.roleName} para el seed de empleado`);
      }
      seededEmpleados.push({
        nombreCompleto: empleado.nombreCompleto,
        email: empleado.email,
        contrasena: empleado.contrasena,
        telefono: empleado.telefono,
        direccion: empleado.direccion,
        cargo: empleado.cargo,
        rolesIds: [role.id],
      });
    }

    let empleadosCreados = 0;
    let empleadosExistentes = 0;
    let empleadosRolAsignados = 0;

    for (const seedEmpleado of seededEmpleados) {
      const roleId = seedEmpleado.rolesIds?.[0];
      if (!roleId) {
        throw new Error(`No se encontró el rol para el empleado ${seedEmpleado.email}`);
      }

      const empleado = await this.empleadosRepo.findOne({
        where: { email: seedEmpleado.email },
        relations: ['empleadoRoles', 'empleadoRoles.rol'],
      });

      if (!empleado) {
        await this.empleadosService.create(seedEmpleado);
        empleadosCreados += 1;
        empleadosRolAsignados += 1;
      } else {
        empleadosExistentes += 1;
        const tieneRol = empleado.empleadoRoles.some(
          (er) => er.rol?.id === roleId,
        );
        if (!tieneRol) {
          await this.empleadosService.asignarRoles(empleado.id, {
            rolesIds: [roleId],
          });
        }
        empleadosRolAsignados += 1;
      }
    }

    const result: SeedResult = {
      permisos: {
        creados: permisosSeedResult.creados,
        existentes: permisosSeedResult.existentes,
      },
      mediosPago: {
        creados: creadosPagos.length,
        existentes: existentesPagos.length,
      },
      roles: {
        creados: rolesResult.creados.length,
        actualizados: rolesResult.actualizados.length,
        sinCambios: rolesResult.sinCambios.length,
      },
      empleadosSeed: {
        creados: empleadosCreados,
        existentes: empleadosExistentes,
        rolAsignados: empleadosRolAsignados,
      },
    };

    if (logResults) {
      this.logger.log(`Permisos analizados: ${permisosSeedResult.analizados}`);
      this.logger.log(`Permisos existentes: ${result.permisos.existentes}`);
      this.logger.log(`Permisos creados: ${result.permisos.creados}`);
      this.logger.log(`Medios de pago analizados: ${mediosPagoSeed.length}`);
      this.logger.log(
        `Medios de pago existentes: ${result.mediosPago.existentes}`,
      );
      this.logger.log(`Medios de pago creados: ${result.mediosPago.creados}`);
      this.logger.log(`Roles analizados: ${rolesSeed.length}`);
      this.logger.log(`Roles creados: ${result.roles.creados}`);
      this.logger.log(`Roles actualizados: ${result.roles.actualizados}`);
      this.logger.log(`Roles sin cambios: ${result.roles.sinCambios}`);
      this.logger.log(
        `Empleados seed creados: ${result.empleadosSeed.creados}, existentes: ${result.empleadosSeed.existentes}, roles asignados: ${result.empleadosSeed.rolAsignados}`,
      );
    }

    return result;
  }

  private async seedAdminUser(logResults: boolean) {
    const adminEmail = process.env.ADMIN_EMAIL?.trim() || 'martin@gmail.com';
    if (await this.empleadosService.findByEmail(adminEmail)) return;

    const adminRole = await this.rolesService.findByName('Admin');
    if (!adminRole) return;

    const adminDto: CrearEmpleadoDto = {
      nombreCompleto: process.env.ADMIN_NOMBRE || 'Martin Cardozo',
      email: adminEmail,
      contrasena: process.env.ADMIN_PASSWORD || 'Holamundo123!',
      telefono: process.env.ADMIN_TELEFONO || '+54 11 1234 5678',
      direccion:
        process.env.ADMIN_DIRECCION || 'Av. Corrientes 1234, Buenos Aires',
      cargo: process.env.ADMIN_CARGO || 'Admin',
      rolesIds: [adminRole.id],
    };

    await this.empleadosService.create(adminDto);
    if (logResults) {
      this.logger.log(`Admin inicial creado: ${adminEmail}`);
    }
  }
}
