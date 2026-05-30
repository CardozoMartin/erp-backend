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
import { permisosSeed } from 'src/permisos/permisos-seed';
import {
  AnchoTicket,
  CondicionIva,
  Sucursal,
  TipoImpresora,
} from 'src/sucursal/entities/sucursal.entity';
import { SucursalService } from 'src/sucursal/sucursal.service';
import { EmpleadoSucursal } from 'src/empleados/entities/empleado-sucursal.entity';

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
  sucursales: {
    creadas: number;
    existentes: number;
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
    private readonly sucursalService: SucursalService,
    @InjectRepository(Empleado)
    private readonly empleadosRepo: Repository<Empleado>,
    @InjectRepository(EmpleadoSucursal)
    private readonly empleadoSucursalRepo: Repository<EmpleadoSucursal>,
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

    const sucursalesResult = await this.seedSucursales();
    const sucursalPrincipal = sucursalesResult.sucursales[0];
    const sucursalesAdmin = sucursalesResult.sucursales;

    const rolesSeedConAdminCompleto = rolesSeed.map((rol) =>
      rol.nombre === 'Admin'
        ? {
            ...rol,
            rutaInicio: '/',
            permisosClaves: permisosSeed.map((permiso) => permiso.clave),
          }
        : rol,
    );

    const rolesResult =
      await this.rolesService.syncSeedRoles(rolesSeedConAdminCompleto);
    await this.seedAdminUser(logResults, sucursalPrincipal, sucursalesAdmin);

    const rolesPorNombre = new Map(
      [
        ...rolesResult.creados,
        ...rolesResult.actualizados,
        ...rolesResult.sinCambios,
      ].map((rol) => [rol.nombre, rol]),
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
        sucursalId: sucursalPrincipal?.id,
        esSucursalPrincipal: true,
      },
    ];

    for (const empleado of empleadosSeed) {
      const role = rolesPorNombre.get(empleado.roleName);
      if (!role) {
        throw new Error(
          `No se encontró el rol ${empleado.roleName} para el seed de empleado`,
        );
      }
      seededEmpleados.push({
        nombreCompleto: empleado.nombreCompleto,
        email: empleado.email,
        contrasena: empleado.contrasena,
        telefono: empleado.telefono,
        direccion: empleado.direccion,
        cargo: empleado.cargo,
        rolesIds: [role.id],
        sucursalId: sucursalPrincipal?.id,
        esSucursalPrincipal: true,
      });
    }

    let empleadosCreados = 0;
    let empleadosExistentes = 0;
    let empleadosRolAsignados = 0;

    for (const seedEmpleado of seededEmpleados) {
      const roleId = seedEmpleado.rolesIds?.[0];
      if (!roleId) {
        throw new Error(
          `No se encontró el rol para el empleado ${seedEmpleado.email}`,
        );
      }

      const empleado = await this.empleadosRepo.findOne({
        where: { email: seedEmpleado.email },
        relations: ['empleadoRoles', 'empleadoRoles.rol'],
      });

      if (!empleado) {
        await this.empleadosService.create(seedEmpleado);
        const empleadoCreado = await this.empleadosRepo.findOne({
          where: { email: seedEmpleado.email },
        });
        if (empleadoCreado && sucursalPrincipal) {
          await this.asignarSucursalesSeed(
            empleadoCreado.id,
            seedEmpleado.email === 'martin@gmail.com'
              ? sucursalesAdmin
              : [sucursalPrincipal],
            sucursalPrincipal.id,
          );
        }
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
        if (sucursalPrincipal) {
          await this.asignarSucursalesSeed(
            empleado.id,
            seedEmpleado.email === 'martin@gmail.com'
              ? sucursalesAdmin
              : [sucursalPrincipal],
            sucursalPrincipal.id,
          );
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
      sucursales: {
        creadas: sucursalesResult.creadas,
        existentes: sucursalesResult.existentes,
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
        `Sucursales seed creadas: ${result.sucursales.creadas}, existentes: ${result.sucursales.existentes}`,
      );
      this.logger.log(
        `Empleados seed creados: ${result.empleadosSeed.creados}, existentes: ${result.empleadosSeed.existentes}, roles asignados: ${result.empleadosSeed.rolAsignados}`,
      );
    }

    return result;
  }

  private async seedAdminUser(
    logResults: boolean,
    sucursalPrincipal?: Sucursal,
    sucursalesAdmin: Sucursal[] = [],
  ) {
    const adminEmail = process.env.ADMIN_EMAIL?.trim() || 'martin@gmail.com';

    const adminRole = await this.rolesService.findByName('Admin');
    if (!adminRole) return;
    const adminExistente = await this.empleadosService.findByEmail(adminEmail);
    if (adminExistente) {
      await this.empleadosService.asignarRoles(adminExistente.id, {
        rolesIds: [adminRole.id],
      });
      if (sucursalPrincipal) {
        await this.asignarSucursalesSeed(
          adminExistente.id,
          sucursalesAdmin,
          sucursalPrincipal.id,
        );
      }
      return;
    }

    const adminDto: CrearEmpleadoDto = {
      nombreCompleto: process.env.ADMIN_NOMBRE || 'Martin Cardozo',
      email: adminEmail,
      contrasena: process.env.ADMIN_PASSWORD || 'Holamundo123!',
      telefono: process.env.ADMIN_TELEFONO || '+54 11 1234 5678',
      direccion:
        process.env.ADMIN_DIRECCION || 'Av. Corrientes 1234, Buenos Aires',
      cargo: process.env.ADMIN_CARGO || 'Admin',
      rolesIds: [adminRole.id],
      sucursalId: sucursalPrincipal?.id,
      esSucursalPrincipal: true,
    };

    const adminCreado = await this.empleadosService.create(adminDto);
    if (sucursalPrincipal) {
      await this.asignarSucursalesSeed(
        adminCreado.id,
        sucursalesAdmin,
        sucursalPrincipal.id,
      );
    }
    if (logResults) {
      this.logger.log(`Admin inicial creado: ${adminEmail}`);
    }
  }

  private async seedSucursales(): Promise<{
    sucursales: Sucursal[];
    creadas: number;
    existentes: number;
  }> {
    const empresaId = '11111111-1111-4111-8111-111111111111';
    const sucursalesSeed = [
      {
        empresa_id: empresaId,
        nombre: 'Shaddai',
        nombreFantasia: 'Shaddai Casa Central',
        direccion: 'Av. San Martin 1234',
        localidad: 'Buenos Aires',
        provincia: 'Buenos Aires',
        codigoPostal: '1001',
        telefono: '+54 11 4000-1001',
        email: 'central@shaddai.com',
        cuit: '20-12345678-3',
        razonSocial: 'Shaddai S.A.',
        condicionIva: CondicionIva.RESPONSABLE_INSCRIPTO,
        puntoVentaArca: '0001',
        ingresosBrutos: '901-123456-7',
        inicioActividades: '2024-01-01',
        mensajePieTicket: 'Gracias por su compra',
        emailComprobantes: 'facturacion@shaddai.com',
        tipoImpresora: TipoImpresora.TERMICA,
        anchoTicket: AnchoTicket.MM_80,
        activa: true,
      },
      {
        empresa_id: empresaId,
        nombre: 'Shaddai2',
        nombreFantasia: 'Shaddai Sucursal 2',
        direccion: 'Belgrano 2450',
        localidad: 'Cordoba',
        provincia: 'Cordoba',
        codigoPostal: '5000',
        telefono: '+54 351 400-2002',
        email: 'sucursal2@shaddai.com',
        cuit: '20-87654321-7',
        razonSocial: 'Shaddai Sucursal 2 S.A.',
        condicionIva: CondicionIva.MONOTRIBUTISTA,
        puntoVentaArca: '0002',
        ingresosBrutos: '904-765432-1',
        inicioActividades: '2024-02-01',
        mensajePieTicket: 'Gracias por elegir Shaddai2',
        emailComprobantes: 'facturacion2@shaddai.com',
        tipoImpresora: TipoImpresora.TERMICA,
        anchoTicket: AnchoTicket.MM_80,
        activa: true,
      },
    ];

    const existentes = await this.sucursalService.findAll();
    const sucursalesPorNombre = new Map(
      existentes.map((sucursal) => [sucursal.nombre.toLowerCase(), sucursal]),
    );
    const sucursales: Sucursal[] = [];
    let creadas = 0;
    let existentesCount = 0;

    for (const sucursalSeed of sucursalesSeed) {
      const existente = sucursalesPorNombre.get(
        sucursalSeed.nombre.toLowerCase(),
      );
      if (existente) {
        sucursales.push(existente);
        existentesCount += 1;
        continue;
      }

      const creada = await this.sucursalService.create(sucursalSeed);
      sucursales.push(creada);
      creadas += 1;
    }

    return { sucursales, creadas, existentes: existentesCount };
  }

  private async asignarSucursalesSeed(
    empleadoId: string,
    sucursales: Sucursal[],
    sucursalPrincipalId: string,
  ): Promise<void> {
    if (!sucursales.length) return;

    await this.empleadoSucursalRepo.update(
      { empleado: { id: empleadoId }, esSucursalPrincipal: true },
      { esSucursalPrincipal: false },
    );

    const asignaciones = await this.empleadoSucursalRepo.find({
      where: { empleado: { id: empleadoId } },
      relations: ['sucursal'],
    });

    for (const sucursal of sucursales) {
      const existente = asignaciones.find(
        (asignacion) => asignacion.sucursal.id === sucursal.id,
      );

      if (existente) {
        existente.activo = true;
        existente.esSucursalPrincipal = sucursal.id === sucursalPrincipalId;
        await this.empleadoSucursalRepo.save(existente);
        continue;
      }

      await this.empleadoSucursalRepo.save(
        this.empleadoSucursalRepo.create({
          empleado: { id: empleadoId } as Empleado,
          sucursal,
          activo: true,
          esSucursalPrincipal: sucursal.id === sucursalPrincipalId,
        }),
      );
    }
  }
}
