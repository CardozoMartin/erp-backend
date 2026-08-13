import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Readable } from 'stream';
import { Repository } from 'typeorm';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { UpsertConfiguracionCloudinaryDto } from './dto/configuracion-cloudinary.dto';
import { ConfiguracionCloudinarySucursal } from './entities/configuracion-cloudinary.entity';

type CloudinaryCredentials = {
  cloud_name: string;
  api_key: string;
  api_secret: string;
};

type SafeCloudinaryConfig = Omit<ConfiguracionCloudinarySucursal, 'api_secret_encriptado'> & {
  api_secret_configurado: boolean;
  disponible: boolean;
  fuente: 'SUCURSAL' | 'ENV';
};

@Injectable()
export class CloudinaryService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ConfiguracionCloudinarySucursal)
    private readonly cloudinaryConfigRepo: Repository<ConfiguracionCloudinarySucursal>,
    private readonly auditoriaService: AuditoriaService,
  ) {
  }

  async findBySucursal(sucursalId: string): Promise<SafeCloudinaryConfig> {
    const config = await this.cloudinaryConfigRepo.findOne({
      where: { sucursal_id: sucursalId },
    });
    if (config) return this.toSafeConfig(config, 'SUCURSAL');

    const env = this.envCredentials();
    return {
      id: 'env',
      sucursal_id: sucursalId,
      activo: !!env,
      cloud_name: env?.cloud_name ?? '',
      api_key: env?.api_key ?? '',
      carpeta_base: this.configService.get('CLOUDINARY_FOLDER') ?? null,
      ultimo_test_at: null,
      updated_at: new Date(),
      sucursal: undefined as never,
      api_secret_configurado: !!env?.api_secret,
      disponible: !!env,
      fuente: 'ENV',
    };
  }

  async upsert(
    sucursalId: string,
    dto: UpsertConfiguracionCloudinaryDto,
    empleadoActorId?: string | null,
  ): Promise<SafeCloudinaryConfig> {
    const current = await this.cloudinaryConfigRepo.findOne({
      where: { sucursal_id: sucursalId },
    });
    const apiSecret = dto.api_secret?.trim();
    if (!current && !apiSecret) {
      throw new BadRequestException('Ingrese el API Secret de Cloudinary');
    }

    const entity = this.cloudinaryConfigRepo.create({
      ...(current ?? {}),
      sucursal_id: sucursalId,
      activo: false,
      cloud_name: dto.cloud_name.trim(),
      api_key: dto.api_key.trim(),
      carpeta_base: dto.carpeta_base?.trim() || 'productos',
      ultimo_test_at: null,
      api_secret_encriptado: apiSecret
        ? this.encrypt(apiSecret)
        : current?.api_secret_encriptado,
    });
    const saved = await this.cloudinaryConfigRepo.save(entity);

    await this.auditoriaService.registrar({
      modulo: 'configuracion',
      accion: current ? 'ACTUALIZAR_CONFIGURACION_CLOUDINARY' : 'CREAR_CONFIGURACION_CLOUDINARY',
      entidad: 'configuracion_cloudinary',
      entidad_id: saved.sucursal_id,
      empleado_id: empleadoActorId ?? null,
      sucursal_id: saved.sucursal_id,
      descripcion: `Configuracion Cloudinary ${current ? 'actualizada' : 'creada'} para sucursal ${saved.sucursal_id}`,
      antes: current ? this.snapshot(current) : null,
      despues: this.snapshot(saved),
      metadata: { api_secret_actualizado: !!apiSecret },
    });

    return this.toSafeConfig(saved, 'SUCURSAL');
  }

  async probar(sucursalId: string, empleadoActorId?: string | null) {
    const config = await this.cloudinaryConfigRepo.findOne({
      where: { sucursal_id: sucursalId },
    });
    if (!config) {
      throw new BadRequestException('Primero guarde la configuracion de Cloudinary');
    }

    cloudinary.config(this.credentialsFromConfig(config));
    try {
      await cloudinary.api.ping();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'error desconocido';
      throw new BadRequestException(
        `Cloudinary rechazo la configuracion: ${msg}`,
      );
    }

    config.activo = true;
    config.ultimo_test_at = new Date();
    await this.cloudinaryConfigRepo.save(config);

    await this.auditoriaService.registrar({
      modulo: 'configuracion',
      accion: 'PROBAR_CONFIGURACION_CLOUDINARY',
      entidad: 'configuracion_cloudinary',
      entidad_id: sucursalId,
      empleado_id: empleadoActorId ?? null,
      sucursal_id: sucursalId,
      descripcion: 'Configuracion Cloudinary verificada y activada',
    });

    return {
      ok: true,
      message: 'Cloudinary verificado correctamente. Ya se pueden subir imagenes.',
    };
  }

  async upload(
    file: Express.Multer.File,
    folder = 'productos',
    sucursalId?: string,
  ): Promise<{
    url: string;
    storage_key: string;
    ancho_px: number;
    alto_px: number;
  }> {
    if (!file) throw new BadRequestException('No se recibio ningun archivo');

    cloudinary.config(await this.resolveCredentials(sucursalId));
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result: UploadApiResponse) => {
          if (error || !result) {
            return reject(
              new BadRequestException({
                message: 'Error al subir imagen',
                cloudinaryError: error?.message,
              }),
            );
          }
          resolve({
            url: result.secure_url,
            storage_key: result.public_id,
            ancho_px: result.width,
            alto_px: result.height,
          });
        },
      );
      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  async delete(storageKey: string, sucursalId?: string): Promise<void> {
    cloudinary.config(await this.resolveCredentials(sucursalId));
    await cloudinary.uploader.destroy(storageKey);
  }

  private async resolveCredentials(sucursalId?: string): Promise<CloudinaryCredentials> {
    if (sucursalId) {
      const config = await this.cloudinaryConfigRepo.findOne({
        where: { sucursal_id: sucursalId },
      });
      if (config) {
        if (!config.activo) {
          throw new BadRequestException('La configuracion de Cloudinary todavia no fue verificada');
        }
        return this.credentialsFromConfig(config);
      }
    }

    const env = this.envCredentials();
    if (env) return env;
    throw new BadRequestException('Configure Cloudinary antes de subir imagenes');
  }

  private envCredentials(): CloudinaryCredentials | null {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) return null;
    return { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret };
  }

  private credentialsFromConfig(config: ConfiguracionCloudinarySucursal): CloudinaryCredentials {
    return {
      cloud_name: config.cloud_name,
      api_key: config.api_key,
      api_secret: this.decrypt(config.api_secret_encriptado),
    };
  }

  private toSafeConfig(
    config: ConfiguracionCloudinarySucursal,
    fuente: 'SUCURSAL' | 'ENV',
  ): SafeCloudinaryConfig {
    const { api_secret_encriptado, ...safe } = config;
    void api_secret_encriptado;
    return {
      ...safe,
      api_secret_configurado: !!config.api_secret_encriptado,
      disponible: fuente === 'ENV' ? true : config.activo,
      fuente,
    };
  }

  private snapshot(config: ConfiguracionCloudinarySucursal) {
    return this.toSafeConfig(config, 'SUCURSAL');
  }

  private getEncryptionKey() {
    const secret =
      process.env.CONFIG_ENCRYPTION_KEY ||
      process.env.CLOUDINARY_ENCRYPTION_KEY ||
      process.env.JWT_SECRET ||
      'erp-local-config-key';
    return createHash('sha256').update(secret).digest();
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  private decrypt(value: string) {
    const [ivText, tagText, encryptedText] = value.split(':');
    if (!ivText || !tagText || !encryptedText) {
      throw new BadRequestException('El API Secret guardado no tiene un formato valido');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getEncryptionKey(),
      Buffer.from(ivText, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagText, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
