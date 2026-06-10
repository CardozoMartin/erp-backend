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
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';

// Configuración de Multer — memoria (sin guardar en disco)
const multerConfig = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    if (file.mimetype?.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          'Solo se permiten archivos de imagen',
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
    @SucursalActiva() sucursalId: string,
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
    return this.imagenService.create(dto, file, sucursalId);
  }

  // GET /imagenes
  @Get()
  findAll() {
    return this.imagenService.findAll();
  }

  // GET /imagenes/producto/:productoId
  @Get('producto/:productoId')
  findByProducto(@Param('productoId') productoId: string) {
    return this.imagenService.findByProducto(productoId);
  }

  // PATCH /imagenes/reordenar
  // Body: { "ids": ["uuid1", "uuid2", "uuid3"] }
  @Patch('reordenar')
  reordenar(@Body() body: { ids: string[] }) {
    return this.imagenService.reordenar(body.ids);
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

  // DELETE /imagenes/:id — elimina de Cloudinary Y de la DB
  @Delete(':id')
  remove(@SucursalActiva() sucursalId: string, @Param('id') id: string) {
    return this.imagenService.remove(id, sucursalId);
  }
}
