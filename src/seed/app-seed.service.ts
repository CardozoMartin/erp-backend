import { Injectable, Logger } from '@nestjs/common';
import { PagosModuleService } from 'src/pagos-module/pagos-module.service';
import { CrearMedioPagoDto } from 'src/pagos-module/dto/create-pagos-module.dto';
import {
  MedioPago,
  TipoMedioPago,
} from 'src/pagos-module/entities/medio-pago.entity';
import { permisosSeed } from 'src/permisos/permisos-seed';
import { PermisosService } from 'src/permisos/permisos.service';
import { rolesSeed } from 'src/roles/roles-seed';
import { RolesService } from 'src/roles/roles.service';
import { CrearEmpleadoDto } from 'src/empleados/dto/create-empleado.dto';
import { EmpleadosService } from 'src/empleados/empleados.service';

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
};

@Injectable()
export class AppSeedService {
  private readonly logger = new Logger(AppSeedService.name);

  constructor(
    private readonly permisosService: PermisosService,
    private readonly pagosService: PagosModuleService,
    private readonly rolesService: RolesService,
    private readonly empleadosService: EmpleadosService,
  ) {}

  async seedInitialData(logResults = true): Promise<SeedResult> {
    const { creados, existentes } =
      await this.permisosService.createMissing(permisosSeed);

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

    const result: SeedResult = {
      permisos: {
        creados: creados.length,
        existentes: existentes.length,
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
    };

    if (logResults) {
      this.logger.log(`Permisos analizados: ${permisosSeed.length}`);
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
