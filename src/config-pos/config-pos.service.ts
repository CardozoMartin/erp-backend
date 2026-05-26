import { Injectable } from '@nestjs/common';
import { ConfigPosDto } from './dto/create-config-po.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigPosSucursal } from './entities/config-pos-sucursal.entity';
import { Repository } from 'typeorm';
import { SucursalService } from 'src/sucursal/sucursal.service';
import { FlujoVenta } from 'src/ventas-modulo/entities/ventas-modulo.entity';

@Injectable()
export class ConfigPosService {
  constructor(
    @InjectRepository(ConfigPosSucursal)
    private readonly configRepo: Repository<ConfigPosSucursal>,
    private readonly sucursalService: SucursalService,
  ) {}

  // Obtener config de una sucursal (crea una por defecto si no existe)
  async findBySucursal(sucursalId: string): Promise<ConfigPosSucursal> {
    const config = await this.configRepo.findOne({
      where: { sucursal: { id: sucursalId } },
      relations: ['sucursal'],
    });

    if (!config) {
      return this.crearConfigDefault(sucursalId);
    }

    return config;
  }

  // Actualizar config de una sucursal
  async update(
    sucursalId: string,
    dto: ConfigPosDto,
  ): Promise<ConfigPosSucursal> {
    let config = await this.configRepo.findOne({
      where: { sucursal: { id: sucursalId } },
      relations: ['sucursal'],
    });

    if (!config) {
      config = await this.crearConfigDefault(sucursalId);
    }

    Object.assign(config, dto);
    return this.configRepo.save(config);
  }

  // Crear config con valores por defecto
  private async crearConfigDefault(
    sucursalId: string,
  ): Promise<ConfigPosSucursal> {
    const sucursal = await this.sucursalService.findOne(sucursalId);

    const config = this.configRepo.create({
      sucursal,
      flujo: FlujoVenta.SIMPLE,
      requiereDespacho: false,
      permiteClienteAnonimo: true,
      permitePagoMixto: true,
      mediosPagoActivos: [],
      listaPrecioDefaultId: null,
    });

    return this.configRepo.save(config);
  }
}
