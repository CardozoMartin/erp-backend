import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductoPreciosService } from 'src/producto_precios/producto_precios.service';
import { DataSource, Repository, IsNull, In } from 'typeorm';
import { AtributoProducto } from '../atributo-producto/entities/atributo-producto.entity';
import { AtributoVariante } from '../atributo-variante/entities/atributo-variante.entity';
import { Imagen } from '../imagen/entities/imagen.entity';
import { Lote } from '../lote/entities/lote.entity';
import { MarcaProducto } from '../marca_productos/entities/marca_producto.entity';
import { Oferta } from '../oferta/entities/oferta.entity';
import { ProductoCategoria } from '../producto-categoria/entities/producto-categoria.entity';
import { Stock } from '../stock/entities/stock.entity';
import { Variante } from '../variante/entities/variante.entity';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { Producto, UnidadVenta } from './entities/producto.entity';
import { UpdateStockDto } from 'src/stock/dto/update-stock.dto';
import { ProductoSucursal } from './entities/producto-sucursal-entity';
import { Sucursal } from 'src/sucursal/entities/sucursal.entity';
import { ProductoPrecio } from 'src/producto_precios/entities/producto_precio.entity';
import { SucursalService } from 'src/sucursal/sucursal.service';
import { AuditoriaService } from 'src/auditoria/auditoria.service';

@Injectable()
export class ProductoService {
  //inicializamos el contrstuctor con el repository
  constructor(
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,

    @InjectRepository(Variante)
    private readonly varianteRepo: Repository<Variante>,

    @InjectRepository(AtributoVariante)
    private readonly atributoRepo: Repository<AtributoVariante>,

    @InjectRepository(AtributoProducto)
    private readonly atributoProductoRepo: Repository<AtributoProducto>,

    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,

    @InjectRepository(Lote)
    private readonly loteRepo: Repository<Lote>,

    @InjectRepository(Imagen)
    private readonly imagenRepo: Repository<Imagen>,

    @InjectRepository(Oferta)
    private readonly ofertaRepo: Repository<Oferta>,

    @InjectRepository(ProductoCategoria)
    private readonly categoriaRepo: Repository<ProductoCategoria>,

    @InjectRepository(MarcaProducto)
    private readonly marcaRepo: Repository<MarcaProducto>,

    @InjectRepository(ProductoSucursal)
    private readonly productoSucursalRepo: Repository<ProductoSucursal>,

    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,

    @InjectRepository(ProductoPrecio)
    private readonly productoPrecioRepo: Repository<ProductoPrecio>,

    private readonly productoPrecioService: ProductoPreciosService,
    private readonly sucursalService: SucursalService,
    private readonly dataSource: DataSource,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  private normalizarPrecios<T extends Record<string, any>>(data: T): T {
    const precioCosto = Number(data.precio_costo ?? 0);
    const precioVenta = Number(data.precio_venta ?? data.precio_base ?? 0);
    const margen =
      precioCosto > 0 ? ((precioVenta - precioCosto) / precioCosto) * 100 : 0;

    return {
      ...data,
      precio_costo: precioCosto,
      precio_venta: precioVenta,
      precio_base: precioVenta,
      margen_ganancia: Number(margen.toFixed(2)),
    };
  }

  private validateWholeUnitStock(
    producto: Pick<Producto, 'unidad_venta' | 'es_fraccionable'>,
    cantidad: number | undefined,
    campo: string,
  ) {
    if (
      cantidad !== undefined &&
      producto.unidad_venta === UnidadVenta.UNIDAD &&
      !producto.es_fraccionable &&
      !Number.isInteger(cantidad)
    ) {
      throw new BadRequestException(
        `${campo} debe ser un número entero para productos vendidos por unidad`,
      );
    }
  }

  private normalizeOptionalText(value: string | null | undefined) {
    if (value === undefined) return undefined;
    const normalized = value?.trim?.() ?? null;
    return normalized || null;
  }

  //Servicio para crear Producto Completo con variantes, atributos, stock, lotes, imagenes y ofertas en una sola transaccion
  async create(
    createProductoDto: CreateProductoDto,
    sucursalActivaId?: string,
    empleadoId?: string | null,
  ): Promise<Producto> {
    createProductoDto.nombre = createProductoDto.nombre.trim();
    createProductoDto.codigo_barras =
      createProductoDto.codigo_barras?.trim() || null;
    const todasSucursales = createProductoDto.todas_sucursales ?? true;
    const sucursalesHabilitadasIds =
      createProductoDto.sucursales_habilitadas_ids ?? [];

    //1.- validamos que el codigo de barras no exista en otro producto
    if (createProductoDto.codigo_barras) {
      const existeCodigo = await this.productoRepo.findOne({
        where: { codigo_barras: createProductoDto.codigo_barras },
      });
      if (existeCodigo) {
        throw new BadRequestException(
          'El código de barras ya existe en otro producto',
        );
      }
    }

    //2.- Validamos si tiene_variantes=true haya variantes en el DTO
    const tieneVariantes =
      createProductoDto.tiene_variantes ??
      (!!createProductoDto.variantes && createProductoDto.variantes.length > 0);

    if (
      tieneVariantes &&
      (!createProductoDto.variantes || createProductoDto.variantes.length === 0)
    ) {
      throw new BadRequestException(
        'Si el producto tiene variantes, debe incluir al menos una variante en el DTO',
      );
    }
    if (
      !tieneVariantes &&
      createProductoDto.variantes &&
      createProductoDto.variantes.length > 0
    ) {
      throw new BadRequestException(
        'Si el producto no tiene variantes, no debe incluir variantes en el DTO',
      );
    }

    //3.- validamos que la categoria exista si se envio categoria_id
    if (createProductoDto.categoria_id) {
      const categoria = await this.categoriaRepo.findOne({
        where: { id: createProductoDto.categoria_id },
      });
      if (!categoria) {
        throw new BadRequestException('La categoría especificada no existe');
      }
    }

    //3.1.- validamos que la marca exista si se envio marca_id
    if (createProductoDto.marca_id) {
      const marca = await this.marcaRepo.findOne({
        where: { id: createProductoDto.marca_id },
      });
      if (!marca) {
        throw new BadRequestException('La marca especificada no existe');
      }
    }

    //4.- verificamos que el nombre del producto no sea vacio con espacios o que ya exista otro producto con el mismo nombre (ignorando mayusculas y minusculas)
    if (createProductoDto.nombre === '') {
      throw new BadRequestException(
        'El nombre del producto no puede estar vacío',
      );
    }
    const existeNombre = await this.productoRepo
      .createQueryBuilder('p')
      .where('LOWER(p.nombre) = LOWER(:nombre)', {
        nombre: createProductoDto.nombre,
      })
      .getOne();
    if (existeNombre) {
      throw new BadRequestException(
        'Ya existe un producto con el mismo nombre',
      );
    }

    //5.- Validamos que no haya duplicados de stock por sucursal a nivel producto
    if (createProductoDto.stock && createProductoDto.stock.length > 0) {
      const sucursales = new Set<string>();
      const productUnitConfig = {
        unidad_venta: createProductoDto.unidad_venta ?? UnidadVenta.UNIDAD,
        es_fraccionable: createProductoDto.es_fraccionable ?? false,
      };
      for (const stockDto of createProductoDto.stock) {
        const sucursalKey = stockDto.sucursal_id || 'stock-general';
        if (sucursales.has(sucursalKey)) {
          throw new BadRequestException(
            stockDto.sucursal_id
              ? `La sucursal ${stockDto.sucursal_id} se repite en stock del producto`
              : 'El stock general se repite en stock del producto',
          );
        }
        sucursales.add(sucursalKey);
        if (stockDto.cantidad !== undefined && stockDto.cantidad < 0) {
          throw new BadRequestException('El stock no puede ser negativo');
        }
        this.validateWholeUnitStock(
          productUnitConfig,
          stockDto.cantidad,
          'La cantidad de stock',
        );
        if (
          stockDto.cantidad_minima !== undefined &&
          stockDto.cantidad_minima < 0
        ) {
          throw new BadRequestException(
            'La cantidad minima no puede ser negativa',
          );
        }
        this.validateWholeUnitStock(
          productUnitConfig,
          stockDto.cantidad_minima,
          'La cantidad mínima de stock',
        );
      }
    }

    //6.- Validacion del precio base del producto, no puede ser negativo
    if (createProductoDto.precio_base < 0) {
      throw new BadRequestException(
        'El precio base del producto no puede ser negativo',
      );
    }

    //7.- Validamos que el precio extra de cada variante no sea negativo
    if (createProductoDto.variantes && createProductoDto.variantes.length > 0) {
      for (const varianteDto of createProductoDto.variantes) {
        if (varianteDto.precio_extra && varianteDto.precio_extra < 0) {
          throw new BadRequestException(
            'El precio extra de la variante no puede ser negativo',
          );
        }
      }
    }
    //8.- Validamos stock, lotes y ofertas de variantes
    if (createProductoDto.variantes && createProductoDto.variantes.length > 0) {
      for (const varianteDto of createProductoDto.variantes) {
        if (varianteDto.stock && varianteDto.stock.length > 0) {
          const sucursales = new Set<string>();
          const productUnitConfig = {
            unidad_venta: createProductoDto.unidad_venta ?? UnidadVenta.UNIDAD,
            es_fraccionable: createProductoDto.es_fraccionable ?? false,
          };
          for (const stockDto of varianteDto.stock) {
            const sucursalKey = stockDto.sucursal_id || 'stock-general';
            if (sucursales.has(sucursalKey)) {
              throw new BadRequestException(
                stockDto.sucursal_id
                  ? `La sucursal ${stockDto.sucursal_id} se repite en stock de una variante`
                  : 'El stock general se repite en stock de una variante',
              );
            }
            sucursales.add(sucursalKey);
            if (stockDto.cantidad !== undefined && stockDto.cantidad < 0) {
              throw new BadRequestException('El stock no puede ser negativo');
            }
            this.validateWholeUnitStock(
              productUnitConfig,
              stockDto.cantidad,
              'La cantidad de stock',
            );
            if (
              stockDto.cantidad_minima !== undefined &&
              stockDto.cantidad_minima < 0
            ) {
              throw new BadRequestException(
                'La cantidad minima no puede ser negativa',
              );
            }
            this.validateWholeUnitStock(
              productUnitConfig,
              stockDto.cantidad_minima,
              'La cantidad mínima de stock',
            );
          }
        }
        if (varianteDto.lotes && varianteDto.lotes.length > 0) {
          for (const loteDto of varianteDto.lotes) {
            if (loteDto.cantidad < 0) {
              throw new BadRequestException(
                'La cantidad del lote no puede ser negativa',
              );
            }
          }
        }
        if (varianteDto.ofertas && varianteDto.ofertas.length > 0) {
          for (const ofertaDto of varianteDto.ofertas) {
            if (ofertaDto.fecha_inicio > ofertaDto.fecha_fin) {
              throw new BadRequestException(
                'La fecha de inicio de oferta no puede ser mayor a la fecha fin',
              );
            }
          }
        }
      }
    }

    if (createProductoDto.ofertas && createProductoDto.ofertas.length > 0) {
      for (const ofertaDto of createProductoDto.ofertas) {
        if (ofertaDto.fecha_inicio > ofertaDto.fecha_fin) {
          throw new BadRequestException(
            'La fecha de inicio de oferta no puede ser mayor a la fecha fin',
          );
        }
      }
    }

    if (
      createProductoDto.lotes &&
      createProductoDto.lotes.length > 0 &&
      !createProductoDto.tiene_vencimiento
    ) {
      throw new BadRequestException(
        'Si el producto no tiene vencimiento, no debe incluir lotes en el DTO',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const {
        todas_sucursales: _todasSucursales,
        sucursales_habilitadas_ids: _sucursalesHabilitadasIds,
        ...productoBaseDto
      } = createProductoDto;
      const producto = this.productoRepo.create({
        ...this.normalizarPrecios(productoBaseDto),
        tiene_variantes: tieneVariantes,
        variantes: undefined,
        stock: undefined,
        lotes: undefined,
        imagenes: undefined,
        ofertas: undefined,
        atributos: undefined,
      });

      await queryRunner.manager.save(producto);

      // Si el producto no tiene variantes y tiene atributos a nivel producto, los guardamos
      if (
        !tieneVariantes &&
        createProductoDto.atributos &&
        createProductoDto.atributos.length > 0
      ) {
        for (const attrDto of createProductoDto.atributos) {
          const atributo = this.atributoProductoRepo.create({
            ...attrDto,
            producto: producto,
          });
          await queryRunner.manager.save(atributo);
        }
      }

      // Si el producto tiene relaciones a nivel producto, las creamos primero
      if (createProductoDto.stock && createProductoDto.stock.length > 0) {
        for (const stockDto of createProductoDto.stock) {
          const stock = this.stockRepo.create({
            ...stockDto,
            producto: producto,
            variante_id: null,
            sucursal_id: stockDto.sucursal_id ?? sucursalActivaId ?? null,
          } as Partial<Stock>);
          await queryRunner.manager.save(stock);
        }
      }

      if (createProductoDto.lotes && createProductoDto.lotes.length > 0) {
        for (const loteDto of createProductoDto.lotes) {
          const lote = this.loteRepo.create({
            ...loteDto,
            producto: producto,
            variante_id: null,
            sucursal_id: loteDto.sucursal_id ?? sucursalActivaId ?? null,
          } as Partial<Lote>);
          await queryRunner.manager.save(lote);
        }
      }

      if (createProductoDto.imagenes && createProductoDto.imagenes.length > 0) {
        for (const imagenDto of createProductoDto.imagenes) {
          const imagen = this.imagenRepo.create({
            ...imagenDto,
            producto: producto,
            variante_id: null,
          });
          await queryRunner.manager.save(imagen);
        }
      }

      if (createProductoDto.ofertas && createProductoDto.ofertas.length > 0) {
        for (const ofertaDto of createProductoDto.ofertas) {
          const oferta = this.ofertaRepo.create({
            ...ofertaDto,
            producto: producto,
            variante_id: null,
          } as Partial<Oferta>);
          await queryRunner.manager.save(oferta);
        }
      }

      // Si el producto tiene variantes, las creamos en cascada
      if (tieneVariantes && createProductoDto.variantes) {
        for (const varianteDto of createProductoDto.variantes) {
          const variante = this.varianteRepo.create({
            ...varianteDto,
            producto: producto,
            atributos: undefined,
            stock: undefined,
            lotes: undefined,
            imagenes: undefined,
            ofertas: undefined,
          });
          await queryRunner.manager.save(variante);

          // Si la variante tiene atributos, los creamos en cascada
          if (varianteDto.atributos && varianteDto.atributos.length > 0) {
            for (const attrDto of varianteDto.atributos) {
              const atributo = this.atributoRepo.create({
                ...attrDto,
                variante: variante,
              });
              await queryRunner.manager.save(atributo);
            }
          }

          if (varianteDto.stock && varianteDto.stock.length > 0) {
            for (const stockDto of varianteDto.stock) {
              const stock = this.stockRepo.create({
                ...stockDto,
                producto: producto,
                variante: variante,
                sucursal_id: stockDto.sucursal_id ?? sucursalActivaId ?? null,
              } as Partial<Stock>);
              await queryRunner.manager.save(stock);
            }
          }

          if (varianteDto.lotes && varianteDto.lotes.length > 0) {
            for (const loteDto of varianteDto.lotes) {
              const lote = this.loteRepo.create({
                ...loteDto,
                producto: producto,
                variante: variante,
                sucursal_id: loteDto.sucursal_id ?? sucursalActivaId ?? null,
              } as Partial<Lote>);
              await queryRunner.manager.save(lote);
            }
          }

          if (varianteDto.imagenes && varianteDto.imagenes.length > 0) {
            for (const imagenDto of varianteDto.imagenes) {
              const imagen = this.imagenRepo.create({
                ...imagenDto,
                producto: producto,
                variante: variante,
              });
              await queryRunner.manager.save(imagen);
            }
          }

          if (varianteDto.ofertas && varianteDto.ofertas.length > 0) {
            for (const ofertaDto of varianteDto.ofertas) {
              const oferta = this.ofertaRepo.create({
                ...ofertaDto,
                producto: producto,
                variante: variante,
              } as Partial<Oferta>);
              await queryRunner.manager.save(oferta);
            }
          }
        }
      }
      //si el producto viene con el precio en el DTO, lo guardamos en la tabla de precios
      if (createProductoDto.precios && createProductoDto.precios.length > 0) {
        for (const precioDto of createProductoDto.precios) {
          await this.productoPrecioService.create({
            ...precioDto,
            producto_id: producto.id,
          });
        }
      }

      // Asignar el producto a las sucursales elegidas desde el alta.
      const sucursales = await this.sucursalRepo.find({
        where:
          todasSucursales || sucursalesHabilitadasIds.length === 0
            ? { activa: true }
            : { activa: true, id: In(sucursalesHabilitadasIds) },
      });

      if (sucursales.length > 0) {
        for (const sucursal of sucursales) {
          const productoSucursal = this.productoSucursalRepo.create({
            producto,
            sucursal,
            activo: true,
          });
          await queryRunner.manager.save(productoSucursal);
        }
      }
      await queryRunner.commitTransaction();
      const creado = await this.findOne(producto.id);
      await this.auditoriaService.registrar({
        modulo: 'productos',
        accion: 'CREAR_PRODUCTO',
        entidad: 'producto',
        entidad_id: creado.id,
        empleado_id: empleadoId ?? null,
        sucursal_id: sucursalActivaId ?? null,
        descripcion: `Producto creado: ${creado.nombre}`,
        despues: this.snapshotProducto(creado),
        metadata: {
          precio_costo: creado.precio_costo,
          precio_venta: creado.precio_venta ?? creado.precio_base,
          margen_ganancia: creado.margen_ganancia,
          stock_total: this.stockTotal(creado),
          variantes: creado.variantes?.length ?? 0,
        },
      });
      return creado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Obtener productos filtrados por sucursales activas
  async findAll(sucursalIds: string[]): Promise<Producto[]> {
    return this.productoRepo
      .createQueryBuilder('producto')
      .innerJoin(
        'producto.sucursales',
        'ps',
        'ps.sucursal_id IN (:...sucursalIds) AND ps.activo = true',
        { sucursalIds },
      )
      .leftJoinAndSelect('producto.categoria', 'categoria')
      .leftJoinAndSelect('producto.marca', 'marca')
      .leftJoinAndSelect(
        'producto.stock',
        'stock',
        'stock.sucursal_id IN (:...sucursalIds)',
        { sucursalIds },
      )
      .leftJoinAndSelect(
        'producto.lotes',
        'lotes',
        'lotes.sucursal_id IN (:...sucursalIds)',
        { sucursalIds },
      )
      .leftJoinAndSelect(
        'producto.precios',
        'precio',
        'precio.sucursal_id IN (:...sucursalIds) OR precio.sucursal_id IS NULL',
        { sucursalIds },
      )
      .leftJoinAndSelect('producto.ofertas', 'ofertas')
      .where('producto.activo = true')
      .getMany();
  }

  async findOne(id: string, sucursalIds?: string[]): Promise<Producto> {
    const query = this.productoRepo
      .createQueryBuilder('producto')
      .leftJoinAndSelect('producto.categoria', 'categoria')
      .leftJoinAndSelect('producto.marca', 'marca')
      .leftJoinAndSelect('producto.variantes', 'variantes')
      .leftJoinAndSelect('variantes.atributos', 'varianteAtributos')
      .leftJoinAndSelect('variantes.imagenes', 'varianteImagenes')
      .leftJoinAndSelect('variantes.ofertas', 'varianteOfertas')
      .leftJoinAndSelect('producto.imagenes', 'imagenes')
      .leftJoinAndSelect('producto.ofertas', 'ofertas')
      .leftJoinAndSelect('producto.atributos', 'atributos')
      .where('producto.id = :id', { id });

    if (sucursalIds?.length) {
      query
        .innerJoin(
          'producto.sucursales',
          'ps',
          'ps.sucursal_id IN (:...sucursalIds) AND ps.activo = true',
          { sucursalIds },
        )
        .leftJoinAndSelect(
          'producto.stock',
          'stock',
          'stock.sucursal_id IN (:...sucursalIds)',
          { sucursalIds },
        )
        .leftJoinAndSelect(
          'variantes.stock',
          'varianteStock',
          'varianteStock.sucursal_id IN (:...sucursalIds)',
          { sucursalIds },
        )
        .leftJoinAndSelect(
          'producto.lotes',
          'lotes',
          'lotes.sucursal_id IN (:...sucursalIds)',
          { sucursalIds },
        )
        .leftJoinAndSelect(
          'variantes.lotes',
          'varianteLotes',
          'varianteLotes.sucursal_id IN (:...sucursalIds)',
          { sucursalIds },
        )
        .leftJoinAndSelect(
          'producto.precios',
          'precios',
          'precios.sucursal_id IN (:...sucursalIds) OR precios.sucursal_id IS NULL',
          { sucursalIds },
        );
    } else {
      query
        .leftJoinAndSelect('producto.stock', 'stock')
        .leftJoinAndSelect('variantes.stock', 'varianteStock')
        .leftJoinAndSelect('producto.lotes', 'lotes')
        .leftJoinAndSelect('variantes.lotes', 'varianteLotes')
        .leftJoinAndSelect('producto.precios', 'precios');
    }

    const producto = await query.getOne();
    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }
    return producto;
  }

  async update(
    id: string,
    updateProductoDto: UpdateProductoDto,
    empleadoId?: string | null,
    sucursalActivaId?: string | null,
  ): Promise<Producto> {
    // 1. Verificar que el producto existe
    const producto = await this.findOne(id);
    const antes = this.snapshotProducto(producto);
    if (updateProductoDto.nombre) {
      updateProductoDto.nombre = updateProductoDto.nombre.trim();
    }
    if (updateProductoDto.codigo_barras !== undefined) {
      updateProductoDto.codigo_barras =
        updateProductoDto.codigo_barras?.trim() || null;
    }

    // 2. Validar nombre único si se está actualizando
    if (
      updateProductoDto.nombre &&
      updateProductoDto.nombre.trim() !== producto.nombre
    ) {
      const existeNombre = await this.productoRepo
        .createQueryBuilder('p')
        .where('LOWER(p.nombre) = LOWER(:nombre) AND p.id != :id', {
          nombre: updateProductoDto.nombre.trim(),
          id,
        })
        .getOne();
      if (existeNombre) {
        throw new BadRequestException(
          'Ya existe un producto con el mismo nombre',
        );
      }
    }

    // 3. Validar código de barras único si se está actualizando
    if (
      updateProductoDto.codigo_barras &&
      updateProductoDto.codigo_barras !== producto.codigo_barras
    ) {
      const existeCodigo = await this.productoRepo.findOne({
        where: { codigo_barras: updateProductoDto.codigo_barras },
      });
      if (existeCodigo && existeCodigo.id !== id) {
        throw new BadRequestException(
          'El código de barras ya existe en otro producto',
        );
      }
    }

    // 4. Validar categoría si se envía
    if (updateProductoDto.categoria_id) {
      const categoria = await this.categoriaRepo.findOne({
        where: { id: updateProductoDto.categoria_id },
      });
      if (!categoria) {
        throw new BadRequestException('La categoría especificada no existe');
      }
    }

    // Validar marca si se envía
    if (updateProductoDto.marca_id) {
      const marca = await this.marcaRepo.findOne({
        where: { id: updateProductoDto.marca_id },
      });
      if (!marca) {
        throw new BadRequestException('La marca especificada no existe');
      }
    }
    //si el producto tiene una oferta  ?
    //primero verificamos que el porudcto tenga activo el campo de la oferta

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 5. Actualizar campos del producto (sin las relaciones)
      const {
        variantes,
        stock,
        lotes,
        imagenes,
        ofertas,
        atributos,
        ...productoData
      } = updateProductoDto;
      Object.assign(producto, this.normalizarPrecios(productoData));
      await queryRunner.manager.save(producto);

      // 6. Sync stock a nivel producto (delete & recreate)
      if (stock !== undefined) {
        await queryRunner.manager.delete(Stock, {
          producto_id: id,
          variante_id: IsNull(),
        });
        if (stock && stock.length > 0) {
          for (const stockDto of stock) {
            const s = this.stockRepo.create({
              ...stockDto,
              producto: producto,
              variante_id: null,
              sucursal_id: stockDto.sucursal_id ?? null,
            } as Partial<Stock>);
            await queryRunner.manager.save(s);
          }
        }
      }

      // 7. Sync lotes a nivel producto
      if (lotes !== undefined) {
        await queryRunner.manager.delete(Lote, {
          producto_id: id,
          variante_id: IsNull(),
        });
        if (lotes && lotes.length > 0) {
          for (const loteDto of lotes) {
            const l = this.loteRepo.create({
              ...loteDto,
              producto: producto,
              variante_id: null,
              sucursal_id: loteDto.sucursal_id ?? null,
            } as Partial<Lote>);
            await queryRunner.manager.save(l);
          }
        }
      }

      // 8. Sync imágenes a nivel producto
      if (imagenes !== undefined) {
        await queryRunner.manager.delete(Imagen, {
          producto_id: id,
          variante_id: IsNull(),
        });
        if (imagenes && imagenes.length > 0) {
          for (const imagenDto of imagenes) {
            const img = this.imagenRepo.create({
              ...imagenDto,
              producto: producto,
              variante_id: null,
            });
            await queryRunner.manager.save(img);
          }
        }
      }

      // 9. Sync ofertas a nivel producto
      if (ofertas !== undefined) {
        await queryRunner.manager.delete(Oferta, {
          producto_id: id,
          variante_id: IsNull(),
        });
        if (ofertas && ofertas.length > 0) {
          for (const ofertaDto of ofertas) {
            const o = this.ofertaRepo.create({
              ...ofertaDto,
              producto: producto,
              variante_id: null,
            } as Partial<Oferta>);
            await queryRunner.manager.save(o);
          }
        }
      }

      // 9.5 Sync atributos a nivel producto
      if (atributos !== undefined) {
        await queryRunner.manager.delete(AtributoProducto, {
          producto_id: id,
        });
        if (atributos && atributos.length > 0) {
          for (const attrDto of atributos) {
            const attr = this.atributoProductoRepo.create({
              ...attrDto,
              producto: producto,
            });
            await queryRunner.manager.save(attr);
          }
        }
      }

      // 10. Sync variantes (delete old, recreate)
      if (variantes !== undefined) {
        // Borrar variantes viejas (cascade borra atributos, stock, lotes, imagenes, ofertas de variante)
        await queryRunner.manager.delete(Variante, { producto_id: id });
        if (variantes && variantes.length > 0) {
          for (const varianteDto of variantes) {
            const variante = this.varianteRepo.create({
              ...varianteDto,
              producto: producto,
              atributos: undefined,
              stock: undefined,
              lotes: undefined,
              imagenes: undefined,
              ofertas: undefined,
            });
            await queryRunner.manager.save(variante);

            if (varianteDto.atributos && varianteDto.atributos.length > 0) {
              for (const attrDto of varianteDto.atributos) {
                const atributo = this.atributoRepo.create({
                  ...attrDto,
                  variante: variante,
                });
                await queryRunner.manager.save(atributo);
              }
            }

            if (varianteDto.stock && varianteDto.stock.length > 0) {
              for (const stockDto of varianteDto.stock) {
                const s = this.stockRepo.create({
                  ...stockDto,
                  producto: producto,
                  variante: variante,
                  sucursal_id: stockDto.sucursal_id ?? null,
                } as Partial<Stock>);
                await queryRunner.manager.save(s);
              }
            }

            if (varianteDto.lotes && varianteDto.lotes.length > 0) {
              for (const loteDto of varianteDto.lotes) {
                const l = this.loteRepo.create({
                  ...loteDto,
                  producto: producto,
                  variante: variante,
                  sucursal_id: loteDto.sucursal_id ?? null,
                } as Partial<Lote>);
                await queryRunner.manager.save(l);
              }
            }

            if (varianteDto.imagenes && varianteDto.imagenes.length > 0) {
              for (const imagenDto of varianteDto.imagenes) {
                const img = this.imagenRepo.create({
                  ...imagenDto,
                  producto: producto,
                  variante: variante,
                });
                await queryRunner.manager.save(img);
              }
            }

            if (varianteDto.ofertas && varianteDto.ofertas.length > 0) {
              for (const ofertaDto of varianteDto.ofertas) {
                const o = this.ofertaRepo.create({
                  ...ofertaDto,
                  producto: producto,
                  variante: variante,
                } as Partial<Oferta>);
                await queryRunner.manager.save(o);
              }
            }
          }
        }
      }

      await queryRunner.commitTransaction();
      const actualizado = await this.findOne(id);
      await this.auditoriaService.registrar({
        modulo: 'productos',
        accion: 'ACTUALIZAR_PRODUCTO',
        entidad: 'producto',
        entidad_id: id,
        empleado_id: empleadoId ?? null,
        sucursal_id: sucursalActivaId ?? null,
        descripcion: `Producto actualizado: ${actualizado.nombre}`,
        antes,
        despues: this.snapshotProducto(actualizado),
        metadata: {
          campos_recibidos: Object.keys(updateProductoDto),
          cambios_sensibles: this.cambiosSensiblesProducto(
            antes,
            this.snapshotProducto(actualizado),
          ),
        },
      });
      return actualizado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(
    id: string,
    empleadoId?: string | null,
    sucursalActivaId?: string | null,
  ): Promise<void> {
    const producto = await this.productoRepo.findOne({ where: { id } });
    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }
    await this.productoRepo.remove(producto);
    await this.auditoriaService.registrar({
      modulo: 'productos',
      accion: 'ELIMINAR_PRODUCTO',
      entidad: 'producto',
      entidad_id: id,
      empleado_id: empleadoId ?? null,
      sucursal_id: sucursalActivaId ?? null,
      descripcion: `Producto eliminado: ${producto.nombre}`,
      antes: this.snapshotProducto(producto),
    });
  }

  //servicio para actualizar el stock de un producto o variante especifica, si se envia el id de la variante se actualiza el stock de la variante, sino se actualiza el stock a nivel producto
  async updateStockProduct(
    id: string,
    dto: UpdateStockDto,
    empleadoId?: string | null,
  ): Promise<Stock> {
    //1.- primero validamos que el producto exista
    const producto = await this.productoRepo.findOne({ where: { id } });
    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }
    //2.- si se envio el id de la variante, validamos que la variante exista y que pertenezca al producto
    let variante: Variante | null = null;
    if (dto.variante_id) {
      variante = await this.varianteRepo.findOne({
        where: { id: dto.variante_id },
      });
      if (!variante) {
        throw new NotFoundException(
          `Variante con ID ${dto.variante_id} no encontrada`,
        );
      }
      if (variante.producto_id !== id) {
        throw new BadRequestException(
          `La variante con ID ${dto.variante_id} no pertenece al producto con ID ${id}`,
        );
      }
    }

    const cantidad =
      dto.cantidad === undefined ? undefined : Number(dto.cantidad);
    const cantidadMinima =
      dto.cantidad_minima === undefined
        ? undefined
        : Number(dto.cantidad_minima);
    const sucursalId = dto.sucursal_id?.trim?.() || null;

    if (
      cantidad !== undefined &&
      (!Number.isFinite(cantidad) || cantidad < 0)
    ) {
      throw new BadRequestException(
        'La cantidad de stock debe ser un número no negativo',
      );
    }
    this.validateWholeUnitStock(producto, cantidad, 'La cantidad de stock');
    if (
      cantidadMinima !== undefined &&
      (!Number.isFinite(cantidadMinima) || cantidadMinima < 0)
    ) {
      throw new BadRequestException(
        'La cantidad mínima de stock debe ser un número no negativo',
      );
    }

    this.validateWholeUnitStock(
      producto,
      cantidadMinima,
      'La cantidad mínima de stock',
    );

    //3.- buscamos el stock para el producto o variante especificada.
    // Si no existe, lo creamos para permitir ajustes iniciales desde la ficha.
    let stock = await this.stockRepo.findOne({
      where: {
        producto_id: id,
        variante_id: dto.variante_id == null ? IsNull() : dto.variante_id,
        sucursal_id: sucursalId == null ? IsNull() : sucursalId,
      },
    });
    const antes = stock ? this.snapshotStock(stock) : null;
    if (!stock) {
      stock = this.stockRepo.create({
        producto,
        producto_id: id,
        variante,
        variante_id: dto.variante_id ?? null,
        sucursal_id: sucursalId,
        cantidad: cantidad ?? 0,
        cantidad_minima: cantidadMinima ?? 0,
        deposito: this.normalizeOptionalText(dto.deposito) ?? null,
        pasillo: this.normalizeOptionalText(dto.pasillo) ?? null,
        estante: this.normalizeOptionalText(dto.estante) ?? null,
        sector: this.normalizeOptionalText(dto.sector) ?? null,
        codigo_ubicacion: this.normalizeOptionalText(dto.codigo_ubicacion) ?? null,
        ubicacion_referencia:
          this.normalizeOptionalText(dto.ubicacion_referencia) ?? null,
      } as Partial<Stock>);
      const guardado = await this.stockRepo.save(stock);
      await this.auditoriaService.registrar({
        modulo: 'productos',
        accion: 'ACTUALIZAR_STOCK_PRODUCTO',
        entidad: 'producto',
        entidad_id: id,
        empleado_id: empleadoId ?? null,
        sucursal_id: sucursalId,
        descripcion: `Stock creado/actualizado para ${producto.nombre}`,
        antes,
        despues: this.snapshotStock(guardado),
        metadata: {
          producto_id: id,
          variante_id: dto.variante_id ?? null,
          operacion: 'CREAR_STOCK',
        },
      });
      return guardado;
    }

    if (cantidad !== undefined) {
      stock.cantidad = cantidad;
    }
    if (cantidadMinima !== undefined) {
      stock.cantidad_minima = cantidadMinima;
    }
    if (dto.deposito !== undefined) {
      stock.deposito = this.normalizeOptionalText(dto.deposito) ?? null;
    }
    if (dto.pasillo !== undefined) {
      stock.pasillo = this.normalizeOptionalText(dto.pasillo) ?? null;
    }
    if (dto.estante !== undefined) {
      stock.estante = this.normalizeOptionalText(dto.estante) ?? null;
    }
    if (dto.sector !== undefined) {
      stock.sector = this.normalizeOptionalText(dto.sector) ?? null;
    }
    if (dto.codigo_ubicacion !== undefined) {
      stock.codigo_ubicacion =
        this.normalizeOptionalText(dto.codigo_ubicacion) ?? null;
    }
    if (dto.ubicacion_referencia !== undefined) {
      stock.ubicacion_referencia =
        this.normalizeOptionalText(dto.ubicacion_referencia) ?? null;
    }
    const guardado = await this.stockRepo.save(stock);
    await this.auditoriaService.registrar({
      modulo: 'productos',
      accion: 'ACTUALIZAR_STOCK_PRODUCTO',
      entidad: 'producto',
      entidad_id: id,
      empleado_id: empleadoId ?? null,
      sucursal_id: sucursalId,
      descripcion: `Stock actualizado para ${producto.nombre}`,
      antes,
      despues: this.snapshotStock(guardado),
      metadata: {
        producto_id: id,
        variante_id: dto.variante_id ?? null,
        campos_recibidos: Object.keys(dto),
      },
    });
    return guardado;
  }

  async adjustStockProduct(
    id: string,
    dto: {
      cantidad: number | string;
      operacion: 'AUMENTAR' | 'RESTAR';
      sucursal_id?: string | null;
      variante_id?: string | null;
    },
    empleadoId?: string | null,
  ): Promise<Stock> {
    const producto = await this.productoRepo.findOne({ where: { id } });
    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    let variante: Variante | null = null;
    if (dto.variante_id) {
      variante = await this.varianteRepo.findOne({
        where: { id: dto.variante_id },
      });
      if (!variante) {
        throw new NotFoundException(
          `Variante con ID ${dto.variante_id} no encontrada`,
        );
      }
      if (variante.producto_id !== id) {
        throw new BadRequestException(
          `La variante con ID ${dto.variante_id} no pertenece al producto con ID ${id}`,
        );
      }
    }

    const cantidad = Number(dto.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new BadRequestException(
        'La cantidad a ajustar debe ser un número mayor a cero',
      );
    }
    this.validateWholeUnitStock(producto, cantidad, 'La cantidad de stock');

    if (!['AUMENTAR', 'RESTAR'].includes(dto.operacion)) {
      throw new BadRequestException('La operación debe ser AUMENTAR o RESTAR');
    }

    const sucursalId = dto.sucursal_id?.trim?.() || null;
    let stock = await this.stockRepo.findOne({
      where: {
        producto_id: id,
        variante_id: dto.variante_id == null ? IsNull() : dto.variante_id,
        sucursal_id: sucursalId == null ? IsNull() : sucursalId,
      },
    });

    const cantidadActual = Number(stock?.cantidad ?? 0);
    const nuevaCantidad =
      dto.operacion === 'AUMENTAR'
        ? cantidadActual + cantidad
        : cantidadActual - cantidad;

    if (nuevaCantidad < 0) {
      throw new BadRequestException('El stock no puede quedar negativo');
    }

    const antes = stock ? this.snapshotStock(stock) : null;
    if (!stock) {
      stock = this.stockRepo.create({
        producto,
        producto_id: id,
        variante,
        variante_id: dto.variante_id ?? null,
        sucursal_id: sucursalId,
        cantidad: nuevaCantidad,
        cantidad_minima: 0,
      } as Partial<Stock>);
      const guardado = await this.stockRepo.save(stock);
      await this.auditoriaService.registrar({
        modulo: 'productos',
        accion: 'AJUSTAR_STOCK_PRODUCTO',
        entidad: 'producto',
        entidad_id: id,
        empleado_id: empleadoId ?? null,
        sucursal_id: sucursalId,
        descripcion: `Stock ${dto.operacion.toLowerCase()} para ${producto.nombre}`,
        antes,
        despues: this.snapshotStock(guardado),
        metadata: {
          producto_id: id,
          variante_id: dto.variante_id ?? null,
          operacion: dto.operacion,
          cantidad_ajustada: cantidad,
          cantidad_anterior: cantidadActual,
          cantidad_nueva: nuevaCantidad,
        },
      });
      return guardado;
    }

    stock.cantidad = nuevaCantidad;
    const guardado = await this.stockRepo.save(stock);
    await this.auditoriaService.registrar({
      modulo: 'productos',
      accion: 'AJUSTAR_STOCK_PRODUCTO',
      entidad: 'producto',
      entidad_id: id,
      empleado_id: empleadoId ?? null,
      sucursal_id: sucursalId,
      descripcion: `Stock ${dto.operacion.toLowerCase()} para ${producto.nombre}`,
      antes,
      despues: this.snapshotStock(guardado),
      metadata: {
        producto_id: id,
        variante_id: dto.variante_id ?? null,
        operacion: dto.operacion,
        cantidad_ajustada: cantidad,
        cantidad_anterior: cantidadActual,
        cantidad_nueva: nuevaCantidad,
      },
    });
    return guardado;
  }
  // Activar/desactivar producto en una sucursal específica
  async toggleSucursal(
    productoId: string,
    sucursalId: string,
    empleadoId?: string | null,
  ): Promise<ProductoSucursal> {
    const registro = await this.productoSucursalRepo.findOne({
      where: { producto_id: productoId, sucursal_id: sucursalId },
    });

    if (!registro) {
      throw new NotFoundException(
        `El producto no está asignado a esa sucursal`,
      );
    }

    const antes = {
      producto_id: registro.producto_id,
      sucursal_id: registro.sucursal_id,
      activo: registro.activo,
    };
    registro.activo = !registro.activo;
    const guardado = await this.productoSucursalRepo.save(registro);
    await this.auditoriaService.registrar({
      modulo: 'productos',
      accion: 'CAMBIAR_ESTADO_PRODUCTO_SUCURSAL',
      entidad: 'producto',
      entidad_id: productoId,
      empleado_id: empleadoId ?? null,
      sucursal_id: sucursalId,
      descripcion: `Producto ${guardado.activo ? 'activado' : 'desactivado'} en sucursal`,
      antes,
      despues: {
        producto_id: guardado.producto_id,
        sucursal_id: guardado.sucursal_id,
        activo: guardado.activo,
      },
    });
    return guardado;
  }

  // Consultar stock de otra sucursal
  async stockEnSucursal(
    productoId: string,
    sucursalId: string,
    sucursalActivaId?: string,
  ): Promise<{ sucursal: string; cantidad: number; precio: number | null }> {
    if (sucursalActivaId && sucursalId !== sucursalActivaId) {
      throw new ForbiddenException(
        'No podes consultar datos de una sucursal distinta a la activa',
      );
    }

    const sucursal = await this.sucursalService.findOne(sucursalId);

    const stock = await this.stockRepo.findOne({
      where: { producto_id: productoId, sucursal_id: sucursalId },
    });

    const precio = await this.productoPrecioRepo.findOne({
      where: { producto_id: productoId, sucursal_id: sucursalId },
    });

    return {
      sucursal: sucursal.nombre,
      cantidad: stock?.cantidad ?? 0,
      precio: precio?.precio ?? null,
    };
  }

  private snapshotProducto(producto: Producto) {
    return {
      id: producto.id,
      nombre: producto.nombre,
      codigo_barras: producto.codigo_barras,
      descripcion: producto.descripcion,
      categoria_id: producto.categoria_id,
      marca_id: producto.marca_id,
      activo: producto.activo,
      activo_pos: producto.activo_pos,
      precio_costo: Number(producto.precio_costo ?? 0),
      precio_base: Number(producto.precio_base ?? 0),
      precio_venta: Number(producto.precio_venta ?? producto.precio_base ?? 0),
      margen_ganancia: Number(producto.margen_ganancia ?? 0),
      unidad_venta: producto.unidad_venta,
      es_fraccionable: producto.es_fraccionable,
      tiene_variantes: producto.tiene_variantes,
      tiene_vencimiento: producto.tiene_vencimiento,
      stock: (producto.stock ?? []).map((stock) => this.snapshotStock(stock)),
      variantes: (producto.variantes ?? []).map((variante) => ({
        id: variante.id,
        sku: variante.sku,
        activo: variante.activo,
        precio_extra: Number(variante.precio_extra ?? 0),
        atributos: (variante.atributos ?? []).map((atributo) => ({
          id: atributo.id,
          tipo: atributo.tipo,
          valor: atributo.valor,
        })),
        stock: (variante.stock ?? []).map((stock) => this.snapshotStock(stock)),
      })),
      imagenes: (producto.imagenes ?? []).map((imagen) => ({
        id: imagen.id,
        url: imagen.url,
        orden: imagen.orden,
      })),
      lotes: (producto.lotes ?? []).map((lote) => ({
        id: lote.id,
        numero_lote: lote.numero_lote,
        cantidad: Number(lote.cantidad ?? 0),
        fecha_vencimiento: lote.fecha_vencimiento,
        sucursal_id: lote.sucursal_id,
      })),
    };
  }

  private snapshotStock(stock: Stock) {
    return {
      id: stock.id,
      producto_id: stock.producto_id,
      variante_id: stock.variante_id,
      sucursal_id: stock.sucursal_id,
      cantidad: Number(stock.cantidad ?? 0),
      cantidad_minima: Number(stock.cantidad_minima ?? 0),
      deposito: stock.deposito,
      pasillo: stock.pasillo,
      estante: stock.estante,
      sector: stock.sector,
      codigo_ubicacion: stock.codigo_ubicacion,
      ubicacion_referencia: stock.ubicacion_referencia,
    };
  }

  private stockTotal(producto: Producto): number {
    const stockProducto = (producto.stock ?? []).reduce(
      (total, stock) => total + Number(stock.cantidad ?? 0),
      0,
    );
    const stockVariantes = (producto.variantes ?? []).reduce(
      (total, variante) =>
        total +
        (variante.stock ?? []).reduce(
          (subtotal, stock) => subtotal + Number(stock.cantidad ?? 0),
          0,
        ),
      0,
    );
    return stockProducto + stockVariantes;
  }

  private cambiosSensiblesProducto(
    antes: ReturnType<ProductoService['snapshotProducto']>,
    despues: ReturnType<ProductoService['snapshotProducto']>,
  ) {
    const camposSensibles = [
      'precio_costo',
      'precio_venta',
      'precio_base',
      'margen_ganancia',
      'activo',
      'activo_pos',
      'categoria_id',
      'marca_id',
    ] as const;

    return camposSensibles
      .filter((campo) => antes[campo] !== despues[campo])
      .map((campo) => ({
        campo,
        antes: antes[campo],
        despues: despues[campo],
      }));
  }
}
