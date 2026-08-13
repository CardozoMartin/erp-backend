export interface FilaProductoExcel {
  nombre: string;
  codigo_barras?: string | null;
  descripcion?: string | null;
  precio_costo?: number;
  precio_venta?: number;
  precio_base?: number;
  categoria?: string | null;
  marca?: string | null;
  unidad_venta?: string;
  es_fraccionable?: boolean;
  /** Alicuota de IVA: 21 general, 10.5 alimentos, 0 exento */
  alicuota_iva?: number;
  stock_inicial?: number;
  stock_minimo?: number;
  fila: number;
}

export interface ResultadoImportacion {
  total: number;
  creados: number;
  errores: { fila: number; nombre: string; motivo: string }[];
}
