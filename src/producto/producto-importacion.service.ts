import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Producto } from './entities/producto.entity';
import { ProductoCategoria } from '../producto-categoria/entities/producto-categoria.entity';
import { MarcaProducto } from '../marca_productos/entities/marca_producto.entity';
import { Stock } from '../stock/entities/stock.entity';
import { UnidadVenta } from './entities/producto.entity';
import { ALICUOTAS_IVA_VALIDAS } from '../arca/arca-iva.helper';
import type { FilaProductoExcel, ResultadoImportacion } from './dto/importar-excel.dto';

// Columnas esperadas en el Excel (fila 1 = encabezado)
const COLUMNAS = [
  'nombre',
  'codigo_barras',
  'descripcion',
  'precio_costo',
  'precio_venta',
  'precio_base',
  'categoria',
  'marca',
  'unidad_venta',
  'es_fraccionable',
  'alicuota_iva',
  'stock_inicial',
  'stock_minimo',
] as const;

@Injectable()
export class ProductoImportacionService {
  constructor(
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(ProductoCategoria)
    private readonly categoriaRepo: Repository<ProductoCategoria>,
    @InjectRepository(MarcaProducto)
    private readonly marcaRepo: Repository<MarcaProducto>,
    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,
  ) {}

  async generarPlantilla(): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Productos');

    sheet.columns = [
      { header: 'nombre *', key: 'nombre', width: 30 },
      { header: 'codigo_barras', key: 'codigo_barras', width: 18 },
      { header: 'descripcion', key: 'descripcion', width: 35 },
      { header: 'precio_costo', key: 'precio_costo', width: 14 },
      { header: 'precio_venta', key: 'precio_venta', width: 14 },
      { header: 'precio_base', key: 'precio_base', width: 14 },
      { header: 'categoria', key: 'categoria', width: 18 },
      { header: 'marca', key: 'marca', width: 18 },
      { header: 'unidad_venta', key: 'unidad_venta', width: 14 },
      { header: 'es_fraccionable', key: 'es_fraccionable', width: 16 },
      { header: 'alicuota_iva', key: 'alicuota_iva', width: 13 },
      { header: 'stock_inicial', key: 'stock_inicial', width: 13 },
      { header: 'stock_minimo', key: 'stock_minimo', width: 13 },
    ];

    // Estilo de encabezado
    sheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } },
      };
    });

    // Fila de ejemplo
    sheet.addRow({
      nombre: 'Producto ejemplo',
      codigo_barras: '7791234567890',
      descripcion: 'Descripción del producto',
      precio_costo: 100,
      precio_venta: 150,
      precio_base: 150,
      categoria: 'General',
      marca: 'Sin marca',
      unidad_venta: 'UNIDAD',
      es_fraccionable: false,
      alicuota_iva: 21,
      stock_inicial: 10,
      stock_minimo: 2,
    });

    // Hoja de instrucciones
    const instrucciones = workbook.addWorksheet('Instrucciones');
    instrucciones.getColumn(1).width = 60;
    const instruccionesData = [
      ['Campo', 'Descripción', 'Obligatorio', 'Valores válidos'],
      ['nombre', 'Nombre del producto', 'Sí', 'Texto libre'],
      ['codigo_barras', 'Código de barras (EAN, SKU, etc.)', 'No', 'Texto libre (debe ser único)'],
      ['descripcion', 'Descripción del producto', 'No', 'Texto libre'],
      ['precio_costo', 'Precio de costo', 'No', 'Número >= 0'],
      ['precio_venta', 'Precio de venta al público', 'No', 'Número >= 0'],
      ['precio_base', 'Precio base (si difiere del precio_venta)', 'No', 'Número >= 0'],
      ['categoria', 'Nombre de la categoría (debe existir en el sistema)', 'No', 'Texto'],
      ['marca', 'Nombre de la marca (debe existir en el sistema)', 'No', 'Texto'],
      ['unidad_venta', 'Unidad de venta', 'No', 'UNIDAD, KG, LITRO, METRO, CM, ML, GR, DOCENA, CAJA, PAQUETE'],
      ['es_fraccionable', 'Si se puede vender fraccionado', 'No', 'true / false'],
      ['alicuota_iva', 'Alicuota de IVA. 21 general; 10.5 alimentos (carne, frutas, verduras, pan, leche); 0 exento', 'No', '21 / 10.5 / 0 (por defecto 21)'],
      ['stock_inicial', 'Cantidad de stock inicial', 'No', 'Número >= 0'],
      ['stock_minimo', 'Alerta de stock mínimo', 'No', 'Número >= 0'],
    ];
    instruccionesData.forEach((row) => instrucciones.addRow(row));
    instrucciones.getRow(1).font = { bold: true };
    instrucciones.columns = [
      { width: 20 }, { width: 50 }, { width: 14 }, { width: 55 },
    ];

    return workbook.xlsx.writeBuffer();
  }

  async importar(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buffer: any,
    sucursalId: string | null,
    empleadoId: string,
  ): Promise<ResultadoImportacion> {
    const workbook = new ExcelJS.Workbook();
    // ExcelJS espera el tipo Buffer legacy — el cast evita el conflicto de tipos TS6
    await workbook.xlsx.load(buffer as Parameters<typeof workbook.xlsx.load>[0]);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('El archivo Excel no contiene hojas');

    const filas = this.parsearFilas(sheet);
    if (!filas.length) throw new BadRequestException('El archivo no contiene filas de datos');

    // Cache de categorías y marcas para no hacer N queries
    const categoriasCache = new Map<string, string>();
    const marcasCache = new Map<string, string>();

    const resultado: ResultadoImportacion = { total: filas.length, creados: 0, errores: [] };

    for (const fila of filas) {
      try {
        if (!fila.nombre?.trim()) {
          resultado.errores.push({ fila: fila.fila, nombre: '', motivo: 'El campo nombre es obligatorio' });
          continue;
        }

        // Resolver categoria_id
        let categoria_id: string | null = null;
        if (fila.categoria?.trim()) {
          const clave = fila.categoria.trim().toLowerCase();
          if (categoriasCache.has(clave)) {
            categoria_id = categoriasCache.get(clave)!;
          } else {
            const cat = await this.categoriaRepo.findOne({
              where: { nombre: fila.categoria.trim() },
            });
            if (cat) {
              categoriasCache.set(clave, cat.id);
              categoria_id = cat.id;
            }
          }
        }

        // Resolver marca_id
        let marca_id: string | null = null;
        if (fila.marca?.trim()) {
          const clave = fila.marca.trim().toLowerCase();
          if (marcasCache.has(clave)) {
            marca_id = marcasCache.get(clave)!;
          } else {
            const marca = await this.marcaRepo.findOne({
              where: { nombre: fila.marca.trim() },
            });
            if (marca) {
              marcasCache.set(clave, marca.id);
              marca_id = marca.id;
            }
          }
        }

        const unidadVenta = this.resolverUnidadVenta(fila.unidad_venta);

        const producto = this.productoRepo.create({
          nombre: fila.nombre.trim(),
          codigo_barras: fila.codigo_barras?.trim() || null,
          descripcion: fila.descripcion?.trim() || '',
          precio_costo: fila.precio_costo ?? 0,
          precio_venta: fila.precio_venta ?? 0,
          precio_base: fila.precio_base ?? fila.precio_venta ?? 0,
          categoria_id,
          marca_id,
          unidad_venta: unidadVenta,
          es_fraccionable: fila.es_fraccionable ?? false,
          // Una alícuota no válida cae al 21% general en vez de rechazar la fila
          alicuota_iva: ALICUOTAS_IVA_VALIDAS.includes(
            fila.alicuota_iva as (typeof ALICUOTAS_IVA_VALIDAS)[number],
          )
            ? fila.alicuota_iva
            : 21,
          activo: true,
          activo_pos: true,
        });

        const guardado = await this.productoRepo.save(producto);

        // Stock inicial si se especificó sucursal y cantidad
        if (sucursalId && (fila.stock_inicial ?? 0) > 0) {
          const stock = this.stockRepo.create({
            producto_id: guardado.id,
            sucursal_id: sucursalId,
            cantidad: fila.stock_inicial ?? 0,
            cantidad_minima: fila.stock_minimo ?? 0,
          });
          await this.stockRepo.save(stock);
        }

        resultado.creados++;
      } catch (err: unknown) {
        const motivo = err instanceof Error ? err.message : 'Error desconocido';
        resultado.errores.push({ fila: fila.fila, nombre: fila.nombre ?? '', motivo });
      }
    }

    return resultado;
  }

  private parsearFilas(sheet: ExcelJS.Worksheet): FilaProductoExcel[] {
    const filas: FilaProductoExcel[] = [];
    let encabezados: string[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        encabezados = (row.values as (string | undefined)[])
          .slice(1)
          .map((v) => String(v ?? '').toLowerCase().trim());
        return;
      }

      const values = row.values as unknown[];
      const obj: Record<string, unknown> = {};
      encabezados.forEach((col, i) => {
        obj[col] = values[i + 1] ?? null;
      });

      // Ignorar filas completamente vacías
      if (!obj['nombre']) return;

      filas.push({
        fila: rowNumber,
        nombre: String(obj['nombre'] ?? ''),
        codigo_barras: obj['codigo_barras'] ? String(obj['codigo_barras']) : null,
        descripcion: obj['descripcion'] ? String(obj['descripcion']) : null,
        precio_costo: this.toNum(obj['precio_costo']),
        precio_venta: this.toNum(obj['precio_venta']),
        precio_base: this.toNum(obj['precio_base']),
        categoria: obj['categoria'] ? String(obj['categoria']) : null,
        marca: obj['marca'] ? String(obj['marca']) : null,
        unidad_venta: obj['unidad_venta'] ? String(obj['unidad_venta']) : undefined,
        es_fraccionable: this.toBool(obj['es_fraccionable']),
        alicuota_iva: obj['alicuota_iva'] !== undefined && obj['alicuota_iva'] !== null
          ? this.toNum(obj['alicuota_iva'])
          : undefined,
        stock_inicial: this.toNum(obj['stock_inicial']),
        stock_minimo: this.toNum(obj['stock_minimo']),
      });
    });

    return filas;
  }

  private toNum(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  private toBool(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    const s = String(value ?? '').toLowerCase().trim();
    return s === 'true' || s === '1' || s === 'si' || s === 'sí' || s === 'yes';
  }

  private resolverUnidadVenta(value: string | undefined): UnidadVenta {
    if (!value) return UnidadVenta.UNIDAD;
    const upper = value.toUpperCase().trim() as UnidadVenta;
    return Object.values(UnidadVenta).includes(upper) ? upper : UnidadVenta.UNIDAD;
  }
}
