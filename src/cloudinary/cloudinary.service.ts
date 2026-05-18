import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get('CLOUDINARY_API_SECRET');
    console.log('[CloudinaryDebug] Config:', {
      cloud_name: cloudName ? 'OK' : 'FALTA',
      api_key: apiKey ? 'OK' : 'FALTA',
      api_secret: apiSecret ? 'OK' : 'FALTA',
    });
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  // Sube el buffer de Multer a Cloudinary y devuelve url + public_id
  async upload(
    file: Express.Multer.File,
    folder = 'productos',
  ): Promise<{
    url: string;
    storage_key: string;
    ancho_px: number;
    alto_px: number;
  }> {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');

    console.log('[CloudinaryDebug] Upload solicitado:', {
      folder,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          // Transformación automática: optimiza calidad y formato
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result: UploadApiResponse) => {
          if (error || !result) {
            console.error('[CloudinaryDebug] Error al subir imagen:', error);
            return reject(
              new BadRequestException({
                message: 'Error al subir imagen',
                cloudinaryError: error?.message,
              }),
            );
          }
          resolve({
            url: result.secure_url,
            storage_key: result.public_id, // necesario para eliminar después
            ancho_px: result.width,
            alto_px: result.height,
          });
        },
      );
      // Convertir el buffer de Multer a stream
      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  // Elimina una imagen de Cloudinary usando el public_id
  async delete(storageKey: string): Promise<void> {
    await cloudinary.uploader.destroy(storageKey);
  }
}
