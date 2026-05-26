import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductoPreciosService } from 'src/producto_precios/producto_precios.service';
import { DataSource, Repository, IsNull } from 'typeorm';
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

    private readonly productoPrecioService: ProductoPreciosService,
    private readonly dataSource: DataSource,
  ) {}

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

  //Servicio para crear Producto Completo con variantes, atributos, stock, lotes, imagenes y ofertas en una sola transaccion
  async create(createProductoDto: CreateProductoDto): Promise<Producto> {
    createProductoDto.nombre = createProductoDto.nombre.trim();
    createProductoDto.codigo_barras =
      createProductoDto.codigo_barras?.trim() || null;

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
      const producto = this.productoRepo.create({
        ...createProductoDto,
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
            sucursal_id: stockDto.sucursal_id ?? null,
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
            sucursal_id: loteDto.sucursal_id ?? null,
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
                sucursal_id: stockDto.sucursal_id ?? null,
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
                sucursal_id: loteDto.sucursal_id ?? null,
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
      await queryRunner.commitTransaction();
      return this.findOne(producto.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(page: number = 1, limit: number = 30) {
    const [productos, total] = await this.productoRepo.findAndCount({
      relations: [
        'categoria',
        'variantes',
        'variantes.atributos',
        'stock',
        'lotes',
        'imagenes',
        'ofertas',
        'atributos',
        'precios',
        'marca',
      ],
      order: { nombre: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: productos,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Producto> {
    const producto = await this.productoRepo.findOne({
      where: { id },
      relations: [
        'categoria',
        'variantes',
        'variantes.atributos',
        'variantes.stock',
        'variantes.lotes',
        'variantes.imagenes',
        'variantes.ofertas',
        'stock',
        'lotes',
        'imagenes',
        'ofertas',
        'atributos',
        'precios',
        'marca',
      ],
    });
    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }
    return producto;
  }

  async update(
    id: string,
    updateProductoDto: UpdateProductoDto,
  ): Promise<Producto> {
    // 1. Verificar que el producto existe
    const producto = await this.findOne(id);
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
      Object.assign(producto, productoData);
      await queryRunner.manager.save(producto);

      // 6. Sync stock a nivel producto (delete & recreate)
      if (stock !== undefined) {
        await queryRunner.manager.delete(Stock, {
          producto_id: id,
          variante_id: null as any,
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
          variante_id: null as any,
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
          variante_id: null as any,
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
          variante_id: null as any,
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
      return this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string): Promise<void> {
    const producto = await this.productoRepo.findOne({ where: { id } });
    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }
    await this.productoRepo.remove(producto);
  }

  //servicio para actualizar el stock de un producto o variante especifica, si se envia el id de la variante se actualiza el stock de la variante, sino se actualiza el stock a nivel producto
  async updateStockProduct(id: string, dto: UpdateStockDto): Promise<Stock> {
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
    if (!stock) {
      stock = this.stockRepo.create({
        producto,
        producto_id: id,
        variante,
        variante_id: dto.variante_id ?? null,
        sucursal_id: sucursalId,
        cantidad: cantidad ?? 0,
        cantidad_minima: cantidadMinima ?? 0,
      } as Partial<Stock>);
      return this.stockRepo.save(stock);
    }

    if (cantidad !== undefined) {
      stock.cantidad = cantidad;
    }
    if (cantidadMinima !== undefined) {
      stock.cantidad_minima = cantidadMinima;
    }
    return this.stockRepo.save(stock);
  }

  async adjustStockProduct(
    id: string,
    dto: {
      cantidad: number | string;
      operacion: 'AUMENTAR' | 'RESTAR';
      sucursal_id?: string | null;
      variante_id?: string | null;
    },
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
      return this.stockRepo.save(stock);
    }

    stock.cantidad = nuevaCantidad;
    return this.stockRepo.save(stock);
  }
}
