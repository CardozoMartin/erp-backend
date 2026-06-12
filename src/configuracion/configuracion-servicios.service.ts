import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfiguracionCloudinarySucursal } from 'src/cloudinary/entities/configuracion-cloudinary.entity';
import { MpConfig } from 'src/mercadopago/entities/mp-config.entity';
import { Repository } from 'typeorm';
import { ConfiguracionEmailSucursal } from './entities/configuracion-email.entity';

export interface EstadoServicioSucursal {
  disponible: boolean;
  estado: 'activo' | 'pendiente' | 'error' | 'no_configurado';
  ultimoTestAt?: Date | null;
}

export interface EstadoServiciosSucursal {
  mercadoPago: EstadoServicioSucursal;
  email: EstadoServicioSucursal;
  cloudinary: EstadoServicioSucursal;
}

@Injectable()
export class ConfiguracionServiciosService {
  constructor(
    @InjectRepository(ConfiguracionEmailSucursal)
    private readonly emailRepo: Repository<ConfiguracionEmailSucursal>,
    @InjectRepository(ConfiguracionCloudinarySucursal)
    private readonly cloudinaryRepo: Repository<ConfiguracionCloudinarySucursal>,
    @InjectRepository(MpConfig)
    private readonly mpRepo: Repository<MpConfig>,
  ) {}

  async getEstadoServicios(sucursalId: string): Promise<EstadoServiciosSucursal> {
    const [email, cloudinary, mercadoPago] = await Promise.all([
      this.emailRepo.findOne({ where: { sucursal_id: sucursalId } }),
      this.cloudinaryRepo.findOne({ where: { sucursal_id: sucursalId } }),
      this.mpRepo.findOne({ where: { sucursalId } }),
    ]);

    return {
      mercadoPago: {
        disponible: mercadoPago?.estado === 'activo',
        estado: this.normalizarEstado(mercadoPago?.estado),
        ultimoTestAt: mercadoPago?.ultimoTest ?? null,
      },
      email: {
        disponible: !!email?.activo,
        estado: email ? (email.activo ? 'activo' : 'pendiente') : 'no_configurado',
        ultimoTestAt: email?.ultimo_test_at ?? null,
      },
      cloudinary: {
        disponible: !!cloudinary?.activo,
        estado: cloudinary
          ? cloudinary.activo
            ? 'activo'
            : 'pendiente'
          : 'no_configurado',
        ultimoTestAt: cloudinary?.ultimo_test_at ?? null,
      },
    };
  }

  private normalizarEstado(
    estado?: string | null,
  ): EstadoServicioSucursal['estado'] {
    if (estado === 'activo' || estado === 'pendiente' || estado === 'error') {
      return estado;
    }
    return 'no_configurado';
  }
}
