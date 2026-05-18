import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Imagen } from './entities/imagen.entity';
import { Producto } from '../producto/entities/producto.entity';
import { Variante } from '../variante/entities/variante.entity';
import { CreateImagenDto } from './dto/create-imagen.dto';
import { UpdateImagenDto } from './dto/update-imagen.dto';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class ImagenService {
  constructor(
    @InjectRepository(Imagen)
    private readonly imagenRepo: Repository<Imagen>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(Variante)
    private readonly varianteRepo: Repository<Variante>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(
    dto: CreateImagenDto,
    file: Express.Multer.File,
  ): Promise<Imagen> {
    console.log('[ImagenDebug] ImagenService.create dto:', dto);
    //!validamos que el producto exissta
    const producto = await this.productoRepo.findOne({
      where: { id: dto.producto_id },
    });
    if (!producto) {
      console.error('[ImagenDebug] Producto no encontrado para imagen:', dto.producto_id);
      throw new NotFoundException('Producto no encontrado');
    }
    console.log('[ImagenDebug] Producto encontrado para imagen:', producto.id);

    //2.- validar variante si viene en el dto
    let variante: Variante | null = null;
    if (dto.variante_id) {
      variante = await this.varianteRepo.findOne({
        where: { id: dto.variante_id },
      });
      if (!variante) {
        console.error('[ImagenDebug] Variante no encontrada para imagen:', dto.variante_id);
        throw new NotFoundException('Variante no encontrada');
      }
      if (variante.producto_id !== dto.producto_id) {
        throw new BadRequestException(
          'La variante no pertenece al producto indicado',
        );
      }
    }
    //3.- subir a cloudinary - carpeta organizada por porudcto y variante
    const { url, storage_key, ancho_px, alto_px } =
      await this.cloudinaryService.upload(
        file,
        `productos/${dto.producto_id}/${dto.variante_id ?? 'sin-variante'}`,
      );
    console.log('[ImagenDebug] Cloudinary upload OK:', {
      url,
      storage_key,
      ancho_px,
      alto_px,
    });

    // 4. Guardar solo la URL y metadatos en la DB
    const imagen = this.imagenRepo.create({
      url,
      storage_key,
      ancho_px,
      alto_px,
      rol: dto.rol,
      alt_text: dto.alt_text ?? null,
      orden: dto.orden ?? 0,
      producto,
      variante,
      variante_id: dto.variante_id ?? null,
      producto_id: dto.producto_id,
    });
    const imagenGuardada = await this.imagenRepo.save(imagen);
    console.log('[ImagenDebug] Imagen guardada en DB:', imagenGuardada);
    return imagenGuardada;
  }

  async findAll(): Promise<Imagen[]> {
    return this.imagenRepo.find({ relations: ['producto', 'variante'] });
  }

  async findOneOrFail(id: string): Promise<Imagen> {
    const imagen = await this.imagenRepo.findOne({
      where: { id },
      relations: ['producto', 'variante'],
    });
    if (!imagen) throw new NotFoundException(`Imagen ${id} no encontrada`);
    return imagen;
  }

  async update(id: string, dto: UpdateImagenDto): Promise<Imagen> {
    const imagen = await this.findOneOrFail(id);
    Object.assign(imagen, dto);
    return this.imagenRepo.save(imagen);
  }

  // ─── Eliminar imagen de Cloudinary Y de la DB ─────────────────────────────
  async remove(id: string): Promise<{ message: string }> {
    const imagen = await this.findOneOrFail(id);

    // Eliminar de Cloudinary si tiene storage_key
    if (imagen.storage_key) {
      await this.cloudinaryService.delete(imagen.storage_key);
    }

    await this.imagenRepo.remove(imagen);
    return { message: 'Imagen eliminada correctamente' };
  }

  // ─── Reordenar imágenes ───────────────────────────────────────────────────
  async reordenar(ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await this.imagenRepo.update(ids[i], { orden: i });
    }
  }
}
