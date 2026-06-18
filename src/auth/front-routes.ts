export type FrontRouteDefinition = {
  path: string;
  label: string;
  requiredAny: string[];
};

export const frontRoutes: FrontRouteDefinition[] = [
  {
    path: '/punto-venta',
    label: 'Punto venta',
    requiredAny: ['ventas.crear', 'caja.cobrar', 'caja.abrir'],
  },
  {
    path: '/punto-venta/ventas-caja',
    label: 'Ventas por caja',
    requiredAny: ['ventas.ver', 'reportes.ver', 'reportes.ventas', 'caja.ver'],
  },
  {
    path: '/pedidos-envio',
    label: 'Pedidos envio',
    requiredAny: ['ventas.ver', 'ventas.crear'],
  },
  {
    path: '/ventas',
    label: 'Ventas',
    requiredAny: ['ventas.ver', 'reportes.ver', 'reportes.ventas'],
  },
  {
    path: '/ventas/:id',
    label: 'Detalle de venta',
    requiredAny: ['ventas.ver', 'reportes.ver', 'reportes.ventas'],
  },
  {
    path: '/ventas-pos',
    label: 'Ventas POS',
    requiredAny: ['ventas.ver', 'reportes.ver', 'reportes.ventas'],
  },
  {
    path: '/cotizaciones',
    label: 'Cotizaciones',
    requiredAny: ['ventas.cotizacion', 'ventas.ver', 'reportes.ver'],
  },
  {
    path: '/facturacion',
    label: 'Facturacion',
    requiredAny: ['ventas.ver', 'reportes.ver', 'reportes.ventas'],
  },
  {
    path: '/despachos',
    label: 'Despachos',
    requiredAny: ['deposito.ver', 'deposito.despachar', 'deposito.recepcionar'],
  },
  {
    path: '/notas-credito',
    label: 'Notas de credito',
    requiredAny: ['ventas.ver', 'reportes.ver', 'reportes.ventas'],
  },
  {
    path: '/cuenta-corriente',
    label: 'Cuenta corriente',
    requiredAny: ['clientes.ver', 'ventas.ver'],
  },
  {
    path: '/listas-precio',
    label: 'Listas de precio',
    requiredAny: ['precios.ver', 'config.listas_precio'],
  },
  {
    path: '/reportes-pos',
    label: 'Reportes POS',
    requiredAny: ['reportes.ver', 'reportes.ventas', 'reportes.caja'],
  },
  {
    path: '/reportes-contables',
    label: 'Reporte contable',
    requiredAny: ['reportes.ver', 'reportes.ventas', 'reportes.caja'],
  },
  {
    path: '/productos',
    label: 'Productos',
    requiredAny: ['productos.ver'],
  },
  {
    path: '/productos/nuevo',
    label: 'Nuevo producto',
    requiredAny: ['productos.crear'],
  },
  {
    path: '/productos/detalles',
    label: 'Detalle de producto',
    requiredAny: ['productos.ver', 'productos.editar'],
  },
  {
    path: '/productos/category',
    label: 'Categorias',
    requiredAny: ['productos.ver', 'productos.crear', 'productos.editar'],
  },
  {
    path: '/productos/marca',
    label: 'Marca de productos',
    requiredAny: ['productos.ver', 'productos.crear', 'productos.editar'],
  },
  {
    path: '/sucursales',
    label: 'Sucursales',
    requiredAny: ['sucursales.ver', 'sucursales.crear', 'sucursales.editar'],
  },
  {
    path: '/sucursales/nuevo',
    label: 'Nueva sucursal',
    requiredAny: ['sucursales.crear'],
  },
  {
    path: '/sucursales/:id/editar',
    label: 'Editar sucursal',
    requiredAny: ['sucursales.editar'],
  },
  {
    path: '/empleados',
    label: 'Empleados',
    requiredAny: ['empleados.ver', 'empleados.gestionar', 'empleados.roles'],
  },
  {
    path: '/empleados/nuevo',
    label: 'Nuevo empleado',
    requiredAny: ['empleados.crear', 'empleados.gestionar'],
  },
  {
    path: '/empleados/:id',
    label: 'Detalle de empleado',
    requiredAny: ['empleados.ver', 'empleados.gestionar', 'empleados.roles'],
  },
  {
    path: '/clientes',
    label: 'Clientes',
    requiredAny: ['clientes.ver', 'clientes.cargar', 'clientes.editar'],
  },
  {
    path: '/clientes/nuevo',
    label: 'Nuevo cliente',
    requiredAny: ['clientes.cargar'],
  },
  {
    path: '/clientes/:clienteId',
    label: 'Detalle de cliente',
    requiredAny: ['clientes.ver', 'clientes.editar'],
  },
  {
    path: '/clientes/:clienteId/cuenta',
    label: 'Cuenta de cliente',
    requiredAny: ['clientes.ver', 'ventas.ver'],
  },
  {
    path: '/caja',
    label: 'Caja',
    requiredAny: ['caja.ver', 'reportes.caja', 'reportes.ver'],
  },
  {
    path: '/caja/movimientos',
    label: 'Movimientos de caja',
    requiredAny: ['caja.movimientos', 'caja.ver'],
  },
  {
    path: '/caja/cierre',
    label: 'Cierre de caja',
    requiredAny: ['caja.cerrar'],
  },
  {
    path: '/caja/ingreso',
    label: 'Nuevo ingreso',
    requiredAny: ['caja.movimientos.crear'],
  },
  {
    path: '/caja/:cajaId',
    label: 'Detalle de caja',
    requiredAny: ['caja.ver', 'reportes.caja', 'reportes.ver'],
  },
  {
    path: '/caja/:cajaId/cierre',
    label: 'Cierre de caja',
    requiredAny: ['caja.cerrar'],
  },
  {
    path: '/ajustes',
    label: 'Ajustes',
    requiredAny: ['admin.servicios', 'config.pos', 'mp.crear', 'mp.leer', 'config.email', 'reportes.ver'],
  },
  {
    path: '/configuracion-pos',
    label: 'Configuracion POS',
    requiredAny: ['admin.servicios', 'config.pos'],
  },
  {
    path: '/configuracion-email',
    label: 'Configuracion Email',
    requiredAny: ['admin.servicios', 'config.email'],
  },
  {
    path: '/configuracion-cloudinary',
    label: 'Configuracion Cloudinary',
    requiredAny: ['admin.servicios', 'config.pos'],
  },
  {
    path: '/configuracion-mercadopago',
    label: 'Mercado Pago',
    requiredAny: ['admin.servicios', 'mp.crear', 'mp.leer', 'config.pos'],
  },
  {
    path: '/auditoria',
    label: 'Auditoria',
    requiredAny: ['reportes.ver'],
  },
];
