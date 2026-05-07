import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { Producto } from './entities/producto.entity';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Lote } from './entities/lote.entity';
import { Imagen } from './entities/imagen.entity';
import { Oferta } from './entities/oferta.entity';
import { Categoria } from './entities/categoria.entity';
import { Stock } from './entities/stock.entity';
import { AtributoVariante } from './entities/atributo-variante.entity';
import { Variante } from './entities/variante.entity';

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

    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,

    @InjectRepository(Lote)
    private readonly loteRepo: Repository<Lote>,

    @InjectRepository(Imagen)
    private readonly imagenRepo: Repository<Imagen>,

    @InjectRepository(Oferta)
    private readonly ofertaRepo: Repository<Oferta>,

    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,

    private readonly dataSource: DataSource,
  ) {}

  //Servicio para crear Producto Completo con variantes, atributos, stock, lotes, imagenes y ofertas en una sola transaccion
  async create(createProductoDto: CreateProductoDto): Promise<Producto> {
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
    if (
      createProductoDto.tiene_variantes &&
      (!createProductoDto.variantes || createProductoDto.variantes.length === 0)
    ) {
      throw new BadRequestException(
        'Si el producto tiene variantes, debe incluir al menos una variante en el DTO',
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

    //4.- verificamos que el nombre del producto no sea vacio con espacios o que ya exista otro producto con el mismo nombre (ignorando mayusculas y minusculas)
    if (createProductoDto.nombre.trim() === '') {
      throw new BadRequestException(
        'El nombre del producto no puede estar vacío',
      );
    }
    const existeNombre = await this.productoRepo
      .createQueryBuilder('p')
      .where('LOWER(p.nombre) = LOWER(:nombre)', {
        nombre: createProductoDto.nombre.trim(),
      })
      .getOne();
    if (existeNombre) {
      throw new BadRequestException(
        'Ya existe un producto con el mismo nombre',
      );
    }

    //5.- Verificamos que el nombre de las variantes no se repita dentro del mismo producto
    if (createProductoDto.variantes && createProductoDto.variantes.length > 0) {
      const nombresVariantes = new Set();
      for (const varianteDto of createProductoDto.variantes) {
        const nombreVariante = (varianteDto as { nombre?: string }).nombre;
        if (nombresVariantes.has(nombreVariante)) {
          throw new BadRequestException(
            `El nombre de la variante "${nombreVariante}" se repite dentro del mismo producto`,
          );
        }
        nombresVariantes.add(nombreVariante);
      }
    }

    //6.- Validacion del precio base del producto, no puede ser negativo
    if (createProductoDto.precio_base < 0) {
      throw new BadRequestException('El precio base del producto no puede ser negativo');
    }

    //7.- Validamos que el precio extra de cada variante no sea negativo
    if (createProductoDto.variantes && createProductoDto.variantes.length > 0) {
      for (const varianteDto of createProductoDto.variantes) {
        if (varianteDto.precio_extra && varianteDto.precio_extra < 0) {
          throw new BadRequestException(
            `El precio extra de la variante "${(varianteDto as { nombre?: string }).nombre}" no puede ser negativo`,
          );
        }
      }
    }

    //8.- Validamos si tiene stock que no sea numero negativo
      if (createProductoDto.variantes && createProductoDto.variantes.length > 0) {
        for (const varianteDto of createProductoDto.variantes) {
          const stock = (varianteDto as { stock?: number }).stock;
          if (
            stock !== undefined &&
            stock < 0
          ) {
            throw new BadRequestException(
              `El stock de la variante "${(varianteDto as { nombre?: string }).nombre}" no puede ser negativo`,
            );
          }
      }
    }

    const queryRunner =
      this.productoRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const producto = this.productoRepo.create({
        ...createProductoDto,
        variantes: undefined,
      });

      await queryRunner.manager.save(producto);

      // Si el producto tiene variantes, las creamos en cascada
      if (createProductoDto.tiene_variantes && createProductoDto.variantes) {
        for (const varianteDto of createProductoDto.variantes) {
          const variante = this.varianteRepo.create({
            ...varianteDto,
            producto: producto,
            atributos: undefined,
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
        }
      }
      await queryRunner.commitTransaction();
      return producto;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  findAll() {
    return `This action returns all producto`;
  }

  findOne(id: number) {
    return `This action returns a #${id} producto`;
  }

  update(id: number, updateProductoDto: UpdateProductoDto) {
    return `This action updates a #${id} producto`;
  }

  remove(id: number) {
    return `This action removes a #${id} producto`;
  }
}
