import { CrearPermisoDto } from './dto/create-permiso.dto';

export const permisosSeed: CrearPermisoDto[] = [
  {
    clave: 'ventas.crear',
    nombre: 'Crear venta',
    modulo: 'ventas',
    descripcion: 'Permite crear una nueva venta',
  },
  {
    clave: 'ventas.cancelar',
    nombre: 'Cancelar venta',
    modulo: 'ventas',
    descripcion: 'Permite cancelar una venta existente',
  },
  {
    clave: 'ventas.ver',
    nombre: 'Ver ventas',
    modulo: 'ventas',
    descripcion: 'Permite ver el listado de ventas',
  },
  {
    clave: 'ventas.descuento',
    nombre: 'Aplicar descuento',
    modulo: 'ventas',
    descripcion: 'Permite aplicar descuentos en una venta',
  },
  {
    clave: 'caja.cobrar',
    nombre: 'Cobrar venta',
    modulo: 'caja',
    descripcion: 'Permite cobrar una venta',
  },
  {
    clave: 'caja.abrir',
    nombre: 'Abrir caja',
    modulo: 'caja',
    descripcion: 'Permite abrir la caja al inicio del turno',
  },
  {
    clave: 'caja.cerrar',
    nombre: 'Cerrar caja',
    modulo: 'caja',
    descripcion: 'Permite cerrar la caja al fin del turno',
  },
  {
    clave: 'caja.movimientos',
    nombre: 'Ver movimientos de caja',
    modulo: 'caja',
    descripcion: 'Permite ver los movimientos de caja',
  },
  {
    clave: 'precios.ver',
    nombre: 'Ver lista de precios',
    modulo: 'precios',
    descripcion: 'Permite ver las listas de precios',
  },
  {
    clave: 'precios.cambiar',
    nombre: 'Cambiar lista de precios',
    modulo: 'precios',
    descripcion: 'Permite cambiar la lista de precios activa',
  },
  {
    clave: 'deposito.despachar',
    nombre: 'Despachar pedido',
    modulo: 'deposito',
    descripcion: 'Permite despachar un pedido desde deposito',
  },
  {
    clave: 'deposito.stock',
    nombre: 'Ver stock',
    modulo: 'deposito',
    descripcion: 'Permite ver el stock disponible',
  },
  {
    clave: 'empleados.gestionar',
    nombre: 'Gestionar empleados',
    modulo: 'admin',
    descripcion: 'Permite crear, editar y desactivar empleados',
  },
  {
    clave: 'empleados.roles',
    nombre: 'Asignar roles',
    modulo: 'admin',
    descripcion: 'Permite asignar roles a empleados',
  },
  {
    clave: 'reportes.ver',
    nombre: 'Ver reportes',
    modulo: 'reportes',
    descripcion: 'Permite ver reportes de ventas y caja',
  },
  {
    clave: 'config.pos',
    nombre: 'Configurar POS',
    modulo: 'admin',
    descripcion: 'Permite configurar el flujo del punto de venta',
  },
];
