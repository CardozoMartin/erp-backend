export type RoleSeed = {
  nombre: string;
  descripcion: string;
  rutaInicio: string;
  permisosClaves: string[];
};

export const rolesSeed: RoleSeed[] = [
  {
    nombre: 'Vendedor',
    descripcion: 'Puede crear y gestionar ventas',
    rutaInicio: '/pos/ventas',
    permisosClaves: [
      'ventas.crear',
      'ventas.cancelar',
      'ventas.ver',
      'ventas.descuento',
      'precios.ver',
    ],
  },
  {
    nombre: 'Cajero',
    descripcion: 'Puede cobrar ventas y manejar caja',
    rutaInicio: '/pos/caja',
    permisosClaves: [
      'ventas.ver',
      'caja.cobrar',
      'caja.abrir',
      'caja.cerrar',
      'caja.movimientos',
    ],
  },
  {
    nombre: 'Vendedor Cajero',
    descripcion: 'Puede vender y cobrar',
    rutaInicio: '/pos/ventas',
    permisosClaves: [
      'ventas.crear',
      'ventas.cancelar',
      'ventas.ver',
      'ventas.descuento',
      'precios.ver',
      'caja.cobrar',
      'caja.abrir',
      'caja.cerrar',
      'caja.movimientos',
    ],
  },
  {
    nombre: 'Deposito',
    descripcion: 'Puede ver stock y despachar pedidos',
    rutaInicio: '/pos/deposito',
    permisosClaves: ['deposito.despachar', 'deposito.stock'],
  },
  {
    nombre: 'Gerente',
    descripcion: 'Acceso completo excepto configuracion del sistema',
    rutaInicio: '/pos/reportes',
    permisosClaves: [
      'ventas.crear',
      'ventas.cancelar',
      'ventas.ver',
      'ventas.descuento',
      'caja.cobrar',
      'caja.abrir',
      'caja.cerrar',
      'caja.movimientos',
      'precios.ver',
      'precios.cambiar',
      'deposito.despachar',
      'deposito.stock',
      'empleados.gestionar',
      'empleados.roles',
      'reportes.ver',
    ],
  },
  {
    nombre: 'Admin',
    descripcion: 'Acceso total al sistema',
    rutaInicio: '/admin',
    permisosClaves: [
      'ventas.crear',
      'ventas.cancelar',
      'ventas.ver',
      'ventas.descuento',
      'caja.cobrar',
      'caja.abrir',
      'caja.cerrar',
      'caja.movimientos',
      'precios.ver',
      'precios.cambiar',
      'deposito.despachar',
      'deposito.stock',
      'empleados.gestionar',
      'empleados.roles',
      'reportes.ver',
      'config.pos',
    ],
  },
];
