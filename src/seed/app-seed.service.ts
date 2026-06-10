import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
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
import {
  ConfiguracionSucursal,
  DescuentoStock,
  DisenoComprobante,
  FormatoImpresionComprobante,
  ModoPOS,
} from 'src/configuracion/entities/configuracion.entity';
import {
  ListaPrecio,
  ModoIvaListaPrecio,
  TipoAjustePrecio,
  TipoListaPrecio,
} from 'src/lista-precio/entities/lista-precio.entity';
import { MarcaProducto } from 'src/marca_productos/entities/marca_producto.entity';
import { ProductoCategoria } from 'src/producto-categoria/entities/producto-categoria.entity';
import { ProductoSucursal } from 'src/producto/entities/producto-sucursal-entity';
import { Producto, UnidadVenta } from 'src/producto/entities/producto.entity';
import { ProductoPrecio } from 'src/producto_precios/entities/producto_precio.entity';
import { Stock } from 'src/stock/entities/stock.entity';

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
  datosPos: {
    productosCreados: number;
    productosExistentes: number;
    stockCreados: number;
    listasPrecioCreadas: number;
    listasPrecioExistentes: number;
    configuracionesActualizadas: number;
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

type ProductoPosSeed = {
  nombre: string;
  codigo_barras: string;
  categoria: string;
  marca: string;
  costo: number;
  precio: number;
  stock: number;
  minima: number;
};

const empleadosSeed: EmpleadoSeed[] = [
  {
    nombreCompleto: 'Todos Permisos',
    email: 'todospermisos@gmail.com',
    contrasena: 'todospermisos',
    telefono: '0000000000',
    direccion: 'Oficina Principal',
    cargo: 'Admin',
    roleName: 'Admin',
  },
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
  {
    nombreCompleto: 'Despacho',
    email: 'despacho@gmail.com',
    contrasena: 'despacho',
    telefono: '0000000000',
    direccion: 'Deposito Principal',
    cargo: 'Despacho',
    roleName: 'Despacho',
  },
];

const productosPosSeed: ProductoPosSeed[] = [
  {
    nombre: 'Fanta naranja 2L',
    codigo_barras: '7790001000011',
    categoria: 'Bebidas',
    marca: 'Coca-Cola',
    costo: 1450,
    precio: 2100,
    stock: 78,
    minima: 12,
  },
  {
    nombre: 'Coca-Cola 2.25L',
    codigo_barras: '7790001000028',
    categoria: 'Bebidas',
    marca: 'Coca-Cola',
    costo: 1600,
    precio: 2350,
    stock: 64,
    minima: 10,
  },
  {
    nombre: 'Sprite 2.25L',
    codigo_barras: '7790001000035',
    categoria: 'Bebidas',
    marca: 'Coca-Cola',
    costo: 1550,
    precio: 2290,
    stock: 52,
    minima: 10,
  },
  {
    nombre: 'Yerba suave 1kg',
    codigo_barras: '7790001000042',
    categoria: 'Almacen',
    marca: 'La Tranquera',
    costo: 2450,
    precio: 3300,
    stock: 40,
    minima: 8,
  },
  {
    nombre: 'Pan lactal blanco',
    codigo_barras: '7790001000059',
    categoria: 'Panificados',
    marca: 'Bimbo',
    costo: 1050,
    precio: 1650,
    stock: 34,
    minima: 6,
  },
  {
    nombre: 'Leche entera 1L',
    codigo_barras: '7790001000066',
    categoria: 'Lacteos',
    marca: 'La Serenisima',
    costo: 780,
    precio: 1200,
    stock: 90,
    minima: 18,
  },
  {
    nombre: 'Arroz largo fino 1kg',
    codigo_barras: '7790001000073',
    categoria: 'Almacen',
    marca: 'Molinos',
    costo: 980,
    precio: 1480,
    stock: 70,
    minima: 14,
  },
  {
    nombre: 'Aceite girasol 900ml',
    codigo_barras: '7790001000080',
    categoria: 'Almacen',
    marca: 'Natura',
    costo: 1800,
    precio: 2650,
    stock: 46,
    minima: 8,
  },
  {
    nombre: 'Detergente limon 750ml',
    codigo_barras: '7790001000097',
    categoria: 'Limpieza',
    marca: 'Magistral',
    costo: 1250,
    precio: 1900,
    stock: 38,
    minima: 6,
  },
  {
    nombre: 'Papel higienico 4 rollos',
    codigo_barras: '7790001000103',
    categoria: 'Limpieza',
    marca: 'Elite',
    costo: 1700,
    precio: 2550,
    stock: 55,
    minima: 10,
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
    @InjectRepository(ProductoCategoria)
    private readonly categoriaRepo: Repository<ProductoCategoria>,
    @InjectRepository(MarcaProducto)
    private readonly marcaRepo: Repository<MarcaProducto>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(ProductoPrecio)
    private readonly productoPrecioRepo: Repository<ProductoPrecio>,
    @InjectRepository(ProductoSucursal)
    private readonly productoSucursalRepo: Repository<ProductoSucursal>,
    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,
    @InjectRepository(ListaPrecio)
    private readonly listaPrecioRepo: Repository<ListaPrecio>,
    @InjectRepository(ConfiguracionSucursal)
    private readonly configuracionRepo: Repository<ConfiguracionSucursal>,
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

    const rolesResult = await this.rolesService.syncSeedRoles(
      rolesSeedConAdminCompleto,
    );
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
            sucursalesAdmin,
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
            sucursalesAdmin,
            sucursalPrincipal.id,
          );
        }
        empleadosRolAsignados += 1;
      }
    }

    const datosPosResult = await this.seedDatosPosPrueba(sucursalesAdmin);

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
      datosPos: datosPosResult,
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
      this.logger.log(
        `Datos POS seed productos creados: ${result.datosPos.productosCreados}, existentes: ${result.datosPos.productosExistentes}, stock creados: ${result.datosPos.stockCreados}`,
      );
      this.logger.log(
        `Listas precio seed creadas: ${result.datosPos.listasPrecioCreadas}, existentes: ${result.datosPos.listasPrecioExistentes}, configuraciones POS actualizadas: ${result.datosPos.configuracionesActualizadas}`,
      );
    }

    return result;
  }

  private async seedDatosPosPrueba(
    sucursales: Sucursal[],
  ): Promise<SeedResult['datosPos']> {
    const sucursalesActivas = sucursales.slice(0, 2);
    if (!sucursalesActivas.length) {
      return {
        productosCreados: 0,
        productosExistentes: 0,
        stockCreados: 0,
        listasPrecioCreadas: 0,
        listasPrecioExistentes: 0,
        configuracionesActualizadas: 0,
      };
    }

    const categorias = new Map<string, ProductoCategoria>();
    const marcas = new Map<string, MarcaProducto>();
    let productosCreados = 0;
    let productosExistentes = 0;
    let stockCreados = 0;

    for (const productoSeed of productosPosSeed) {
      const categoria = await this.obtenerOCrearCategoria(
        productoSeed.categoria,
        categorias,
      );
      const marca = await this.obtenerOCrearMarca(productoSeed.marca, marcas);
      let producto = await this.productoRepo.findOne({
        where: { codigo_barras: productoSeed.codigo_barras },
      });

      if (!producto) {
        producto = await this.productoRepo.save(
          this.productoRepo.create({
            nombre: productoSeed.nombre,
            codigo_barras: productoSeed.codigo_barras,
            descripcion: `Producto seed para pruebas POS: ${productoSeed.nombre}`,
            activo: true,
            activo_pos: true,
            activo_web: false,
            precio_base: productoSeed.precio,
            precio_costo: productoSeed.costo,
            precio_venta: productoSeed.precio,
            margen_ganancia: this.calcularMargen(
              productoSeed.costo,
              productoSeed.precio,
            ),
            unidad_venta: UnidadVenta.UNIDAD,
            tiene_variantes: false,
            tiene_vencimiento: false,
            es_fraccionable: false,
            categoria_id: categoria.id,
            marca_id: marca.id,
          }),
        );
        productosCreados += 1;
      } else {
        producto.activo = true;
        producto.activo_pos = true;
        producto.precio_base = productoSeed.precio;
        producto.precio_costo = productoSeed.costo;
        producto.precio_venta = productoSeed.precio;
        producto.margen_ganancia = this.calcularMargen(
          productoSeed.costo,
          productoSeed.precio,
        );
        producto.categoria_id = producto.categoria_id ?? categoria.id;
        producto.marca_id = producto.marca_id ?? marca.id;
        producto = await this.productoRepo.save(producto);
        productosExistentes += 1;
      }

      await this.obtenerOCrearPrecioProducto(producto.id, productoSeed.precio);

      for (const sucursal of sucursalesActivas) {
        await this.obtenerOCrearProductoSucursal(producto.id, sucursal.id);
        const stockCreado = await this.obtenerOCrearStockSucursal(
          producto.id,
          sucursal.id,
          productoSeed.stock,
          productoSeed.minima,
        );
        if (stockCreado) stockCreados += 1;
      }
    }

    let listasPrecioCreadas = 0;
    let listasPrecioExistentes = 0;
    for (const sucursal of sucursalesActivas) {
      const creada = await this.obtenerOCrearListaBaseIva(sucursal.id);
      if (creada) listasPrecioCreadas += 1;
      else listasPrecioExistentes += 1;
    }

    let configuracionesActualizadas = 0;
    for (const [index, sucursal] of sucursalesActivas.entries()) {
      const existente = await this.configuracionRepo.findOne({
        where: { sucursal_id: sucursal.id },
      });
      await this.configuracionRepo.save(
        this.configuracionRepo.create({
          ...existente,
          sucursal_id: sucursal.id,
          cotizacion_vigencia_horas: 24,
          modo_pos:
            index === 0 ? ModoPOS.CON_DESPACHO : ModoPOS.CAJA_CENTRALIZADA,
          descuento_stock:
            index === 0
              ? DescuentoStock.AL_DESPACHAR
              : DescuentoStock.AL_COBRAR,
          permitir_pago_mixto: true,
          permitir_listas_precio: true,
          permitir_cotizaciones: true,
          prefijo_ticket: index === 0 ? 'TKT-D' : 'TKT-C',
          prefijo_cotizacion: index === 0 ? 'PRE-D' : 'PRE-C',
          prefijo_remito: index === 0 ? 'REM-D' : 'REM-C',
          prefijo_nota_credito: index === 0 ? 'NCA-D' : 'NCA-C',
          punto_venta_arca:
            sucursal.puntoVentaArca ?? (index === 0 ? '0001' : '0002'),
          permitir_cuenta_corriente: true,
          formato_impresion_comprobante:
            index === 0
              ? FormatoImpresionComprobante.TICKET_80MM
              : FormatoImpresionComprobante.BOLETA_A4,
          imprimir_automaticamente: false,
          diseno_comprobante:
            index === 0 ? DisenoComprobante.BASICO : DisenoComprobante.WAVE,
          nombre_fantasia_ticket: sucursal.nombreFantasia ?? sucursal.nombre,
          razon_social_ticket: sucursal.razonSocial ?? null,
          cuit_ticket: sucursal.cuit ?? null,
          ingresos_brutos_ticket: sucursal.ingresosBrutos ?? null,
          inicio_actividades_ticket: sucursal.inicioActividades ?? null,
          domicilio_ticket: sucursal.direccion ?? null,
          telefono_ticket: sucursal.telefono ?? null,
          email_ticket: sucursal.email ?? null,
          web_ticket: null,
          mensaje_ticket: 'Gracias por su compra',
          mensaje_boleta: 'Conserve este comprobante para cambios y garantias.',
          mostrar_detalle_productos: true,
          mostrar_descuentos: true,
          mostrar_recargos: true,
          mostrar_observaciones: true,
          mostrar_datos_fiscales: true,
        }),
      );
      configuracionesActualizadas += 1;
    }

    return {
      productosCreados,
      productosExistentes,
      stockCreados,
      listasPrecioCreadas,
      listasPrecioExistentes,
      configuracionesActualizadas,
    };
  }

  private async obtenerOCrearCategoria(
    nombre: string,
    cache: Map<string, ProductoCategoria>,
  ): Promise<ProductoCategoria> {
    const key = nombre.toLowerCase();
    const cached = cache.get(key);
    if (cached) return cached;

    const existente = await this.categoriaRepo.findOne({ where: { nombre } });
    if (existente) {
      cache.set(key, existente);
      return existente;
    }

    const creada = await this.categoriaRepo.save(
      this.categoriaRepo.create({
        nombre,
        descripcion: `Categoria seed ${nombre}`,
        color_identificador: '#075E54',
        activo: true,
        padre_id: null,
      }),
    );
    cache.set(key, creada);
    return creada;
  }

  private async obtenerOCrearMarca(
    nombre: string,
    cache: Map<string, MarcaProducto>,
  ): Promise<MarcaProducto> {
    const key = nombre.toLowerCase();
    const cached = cache.get(key);
    if (cached) return cached;

    const existente = await this.marcaRepo.findOne({ where: { nombre } });
    if (existente) {
      cache.set(key, existente);
      return existente;
    }

    const creada = await this.marcaRepo.save(
      this.marcaRepo.create({
        nombre,
        descripcion: `Marca seed ${nombre}`,
        logo_url: null,
        activo: true,
      }),
    );
    cache.set(key, creada);
    return creada;
  }

  private async obtenerOCrearPrecioProducto(
    productoId: string,
    precio: number,
  ): Promise<void> {
    const existente = await this.productoPrecioRepo.findOne({
      where: { producto_id: productoId, sucursal_id: IsNull() },
      order: { vigente_desde: 'DESC' },
    });
    if (existente) return;

    await this.productoPrecioRepo.save(
      this.productoPrecioRepo.create({
        producto_id: productoId,
        sucursal_id: null,
        precio,
        moneda: 'ARS',
        vigente_desde: new Date(),
      }),
    );
  }

  private async obtenerOCrearProductoSucursal(
    productoId: string,
    sucursalId: string,
  ): Promise<void> {
    const existente = await this.productoSucursalRepo.findOne({
      where: { producto_id: productoId, sucursal_id: sucursalId },
    });
    if (existente) {
      if (!existente.activo) {
        existente.activo = true;
        await this.productoSucursalRepo.save(existente);
      }
      return;
    }

    await this.productoSucursalRepo.save(
      this.productoSucursalRepo.create({
        producto_id: productoId,
        sucursal_id: sucursalId,
        activo: true,
      }),
    );
  }

  private async obtenerOCrearStockSucursal(
    productoId: string,
    sucursalId: string,
    cantidad: number,
    cantidadMinima: number,
  ): Promise<boolean> {
    const existente = await this.stockRepo.findOne({
      where: {
        producto_id: productoId,
        variante_id: IsNull(),
        sucursal_id: sucursalId,
      },
    });
    if (existente) return false;

    await this.stockRepo.save(
      this.stockRepo.create({
        producto_id: productoId,
        variante_id: null,
        sucursal_id: sucursalId,
        cantidad,
        cantidad_minima: cantidadMinima,
        deposito: 'Deposito principal',
        pasillo: 'POS',
        estante: 'Seed',
        sector: 'Salon',
        codigo_ubicacion: `POS-${productoId.slice(0, 6)}`,
        ubicacion_referencia: 'Stock inicial de pruebas POS',
      }),
    );
    return true;
  }

  private async obtenerOCrearListaBaseIva(
    sucursalId: string,
  ): Promise<boolean> {
    const nombre = 'Base con IVA 21%';
    const existente = await this.listaPrecioRepo.findOne({
      where: { nombre, sucursal_id: sucursalId },
    });
    if (existente) {
      existente.activa = true;
      existente.tipo_lista = TipoListaPrecio.CONTADO;
      existente.tipo_ajuste = TipoAjustePrecio.RECARGO;
      existente.porcentaje = 0;
      existente.modo_iva = ModoIvaListaPrecio.AGREGAR_IVA;
      existente.porcentaje_iva = 21;
      existente.descripcion = 'Lista seed para probar POS con IVA 21%.';
      await this.listaPrecioRepo.save(existente);
      return false;
    }

    await this.listaPrecioRepo.save(
      this.listaPrecioRepo.create({
        nombre,
        sucursal_id: sucursalId,
        tipo_lista: TipoListaPrecio.CONTADO,
        tipo_ajuste: TipoAjustePrecio.RECARGO,
        porcentaje: 0,
        cuotas: null,
        modo_iva: ModoIvaListaPrecio.AGREGAR_IVA,
        porcentaje_iva: 21,
        descripcion: 'Lista seed para probar POS con IVA 21%.',
        activa: true,
      }),
    );
    return true;
  }

  private calcularMargen(costo: number, venta: number): number {
    if (costo <= 0) return 0;
    return Number((((venta - costo) / costo) * 100).toFixed(2));
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
