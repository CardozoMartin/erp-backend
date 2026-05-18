import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImagenService } from './imagen.service';
import { CreateImagenDto } from './dto/create-imagen.dto';
import { UpdateImagenDto } from './dto/update-imagen.dto';

// Configuración de Multer — memoria (sin guardar en disco)
const multerConfig = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    const permitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (permitidos.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          'Solo se permiten imágenes JPG, PNG, WEBP o GIF',
        ),
        false,
      );
    }
  },
};

@Controller('imagenes')
export class ImagenController {
  constructor(private readonly imagenService: ImagenService) {}

  // POST /imagenes
  // Form-data: archivo (file) + producto_id + variante_id? + rol? + alt_text? + orden?
  @Post()
  @UseInterceptors(FileInterceptor('archivo', multerConfig))
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateImagenDto,
  ) {
    console.log('[ImagenDebug] POST /imagenes body:', dto);
    console.log('[ImagenDebug] POST /imagenes file:', file
      ? {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        }
      : null,
    );
    if (!file)
      throw new BadRequestException('El archivo de imagen es requerido');
    return this.imagenService.create(dto, file);
  }

  // GET /imagenes
  @Get()
  findAll() {
    return this.imagenService.findAll();
  }

  // GET /imagenes/producto/:productoId
  @Get('producto/:productoId')
  findByProducto(@Param('productoId') productoId: string) {
    return this.imagenService.findOneOrFail(productoId);
  }

  // GET /imagenes/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.imagenService.findOneOrFail(id);
  }

  // PATCH /imagenes/:id  — solo metadatos (alt_text, orden, rol), NO reemplaza la imagen
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateImagenDto) {
    return this.imagenService.update(id, dto);
  }

  // PATCH /imagenes/reordenar
  // Body: { "ids": ["uuid1", "uuid2", "uuid3"] }
  @Patch('reordenar')
  reordenar(@Body() body: { ids: string[] }) {
    return this.imagenService.reordenar(body.ids);
  }

  // DELETE /imagenes/:id — elimina de Cloudinary Y de la DB
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.imagenService.remove(id);
  }
}
