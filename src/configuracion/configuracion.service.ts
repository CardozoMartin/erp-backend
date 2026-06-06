import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateConfiguracionDto } from './dto/create-configuracion.dto';
import { UpdateConfiguracionDto } from './dto/update-configuracion.dto';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ConfiguracionSucursal,
  DescuentoStock,
  ModoPOS,
} from './entities/configuracion.entity';
import { Repository } from 'typeorm';
import { AuditoriaService } from 'src/auditoria/auditoria.service';

@Injectable()
export class ConfiguracionService {
  private readonly logger = new Logger('ConfigPOSDebug');
  private readonly textFields = [
    'punto_venta_arca',
    'nombre_fantasia_ticket',
    'razon_social_ticket',
    'cuit_ticket',
    'ingresos_brutos_ticket',
    'inicio_actividades_ticket',
    'domicilio_ticket',
    'telefono_ticket',
    'email_ticket',
    'web_ticket',
    'mensaje_ticket',
    'mensaje_boleta',
  ] as const;

  constructor(
    @InjectRepository(ConfiguracionSucursal)
    private readonly configuracionRepo: Repository<ConfiguracionSucursal>,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  private normalizeDto<T extends CreateConfiguracionDto | UpdateConfiguracionDto>(
    dto: T,
    current?: Pick<ConfiguracionSucursal, 'modo_pos' | 'descuento_stock'>,
  ): T {
    const normalized = { ...dto } as Record<string, any>;
    for (const field of this.textFields) {
      if (normalized[field] !== undefined) {
        const value = normalized[field];
        normalized[field] = typeof value === 'string' ? value.trim() || null : value;
      }
    }

    const modoPos = normalized.modo_pos ?? current?.modo_pos ?? ModoPOS.SIMPLE;
    if (modoPos === ModoPOS.CON_DESPACHO) {
      normalized.descuento_stock = DescuentoStock.AL_DESPACHAR;
    } else if (
      normalized.descuento_stock === DescuentoStock.AL_DESPACHAR ||
      !normalized.descuento_stock
    ) {
      normalized.descuento_stock = DescuentoStock.AL_COBRAR;
    }

    return normalized as T;
  }

  async create(
    createConfiguracionDto: CreateConfiguracionDto,
    empleadoActorId?: string | null,
  ): Promise<ConfiguracionSucursal> {
    // Verificar que no exista ya una configuración para esta sucursal
    const existe = await this.configuracionRepo.findOne({
      where: { sucursal_id: createConfiguracionDto.sucursal_id },
    });
    if (existe)
      throw new ConflictException(
        `Ya existe una configuración para la sucursal ${createConfiguracionDto.sucursal_id}`,
      );
    const config = this.configuracionRepo.create(
      this.normalizeDto(createConfiguracionDto),
    );
    const saved = await this.configuracionRepo.save(config);
    this.logger.log(`Configuracion creada=${JSON.stringify(saved)}`);
    await this.auditoriaService.registrar({
      modulo: 'configuracion',
      accion: 'CREAR_CONFIGURACION_POS',
      entidad: 'configuracion_pos',
      entidad_id: saved.sucursal_id,
      empleado_id: empleadoActorId ?? null,
      sucursal_id: saved.sucursal_id,
      descripcion: `Configuracion POS creada para sucursal ${saved.sucursal_id}`,
      despues: this.snapshotConfig(saved) as any,
    });
    return saved;
  }

  async findBySucursal(sucursalId: string): Promise<ConfiguracionSucursal> {
    const config = await this.configuracionRepo.findOne({
      where: { sucursal_id: sucursalId },
    });
    if (!config)
      throw new NotFoundException(
        `No hay configuración para la sucursal ${sucursalId}`,
      );
    this.logger.log(
      `Configuracion encontrada sucursal=${sucursalId} data=${JSON.stringify(config)}`,
    );
    return config;
  }

  findOne(id: number) {
    return `This action returns a #${id} configuracion`;
  }

  async update(
    sucursalId: string,
    dto: UpdateConfiguracionDto,
    empleadoActorId?: string | null,
  ): Promise<ConfiguracionSucursal> {
    const config = await this.findBySucursal(sucursalId);
    const antes = this.snapshotConfig(config);
    this.logger.log(
      `Configuracion antes update sucursal=${sucursalId} data=${JSON.stringify(config)}`,
    );
    this.logger.log(
      `Configuracion patch recibido sucursal=${sucursalId} patch=${JSON.stringify(dto)}`,
    );
    Object.assign(config, this.normalizeDto(dto, config));
    const saved = await this.configuracionRepo.save(config);
    this.logger.log(
      `Configuracion despues update sucursal=${sucursalId} data=${JSON.stringify(saved)}`,
    );
    await this.auditoriaService.registrar({
      modulo: 'configuracion',
      accion: 'ACTUALIZAR_CONFIGURACION_POS',
      entidad: 'configuracion_pos',
      entidad_id: sucursalId,
      empleado_id: empleadoActorId ?? null,
      sucursal_id: sucursalId,
      descripcion: `Configuracion POS actualizada para sucursal ${sucursalId}`,
      antes: antes as any,
      despues: this.snapshotConfig(saved) as any,
      metadata: {
        campos_recibidos: Object.keys(dto),
        cambios_sensibles: this.cambiosSensiblesConfig(antes, this.snapshotConfig(saved)),
      },
    });
    return saved;
  }

  async crearPorDefecto(sucursalId: string): Promise<ConfiguracionSucursal> {
    const existe = await this.configuracionRepo.findOne({
      where: { sucursal_id: sucursalId },
    });
    if (existe) {
      this.logger.log(
        `Configuracion existente usada sucursal=${sucursalId} modo=${existe.modo_pos}`,
      );
      return existe;
    }

    const config = this.configuracionRepo.create({ sucursal_id: sucursalId });
    const saved = await this.configuracionRepo.save(config);
    this.logger.log(`Configuracion default creada=${JSON.stringify(saved)}`);
    return saved;
  }

  private snapshotConfig(config: ConfiguracionSucursal) {
    return { ...config };
  }

  private cambiosSensiblesConfig(antes: Record<string, any>, despues: Record<string, any>) {
    const camposSensibles = [
      'modo_pos',
      'descuento_stock',
      'permite_pago_mixto',
      'requiere_caja_abierta',
      'facturacion_electronica_activa',
      'punto_venta_arca',
      'cuenta_corriente_activa',
      'limite_credito_default',
      'recargo_mora_activo',
      'porcentaje_recargo_mora',
    ];
    return camposSensibles.filter((campo) => antes[campo] !== despues[campo]);
  }
}
