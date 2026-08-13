import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArcaConfig, ArcaAmbiente } from './entities/arca-config.entity';
import { ArcaWsaaService } from './arca-wsaa.service';
import {
  ArcaWsfev1Service,
  SolicitudCAE,
  RespuestaCAE,
  CODIGO_NOTA_CREDITO,
} from './arca-wsfev1.service';
import { CifradoService } from 'src/shared/cifrado.service';
import { ARCA_CIFRADO } from 'src/shared/shared.module';
import { GuardarArcaDto, CambiarAmbienteArcaDto } from './dto/guardar-arca.dto';
import { TipoComprobante } from 'src/comprobantes/entities/comprobante.entity';

export interface ResumenArcaConfig {
  configurado: boolean;
  id?: string;
  sucursalId?: string;
  cuit?: string;
  puntoVenta?: string;
  ambiente?: ArcaAmbiente;
  estado?: string;
  ticketVigente?: boolean;
  ultimoTest?: Date | null;
  ultimoError?: string | null;
  updatedAt?: Date;
}

@Injectable()
export class ArcaService {
  private readonly logger = new Logger(ArcaService.name);

  /** Encadena las solicitudes de CAE por sucursal para no pedir dos veces el mismo número */
  private readonly colaPorSucursal = new Map<string, Promise<void>>();

  constructor(
    @InjectRepository(ArcaConfig)
    private readonly repo: Repository<ArcaConfig>,
    @Inject(ARCA_CIFRADO)
    private readonly cifrado: CifradoService,
    private readonly wsaa: ArcaWsaaService,
    private readonly wsfev1: ArcaWsfev1Service,
  ) {}

  // ── Gestión de configuración ──────────────────────────────────────────────

  async guardarCredenciales(dto: GuardarArcaDto): Promise<{ ok: boolean; id: string }> {
    let config = await this.repo.findOne({ where: { sucursalId: dto.sucursalId } });
    if (!config) config = this.repo.create();

    config.sucursalId      = dto.sucursalId;
    config.cuit            = dto.cuit;
    config.puntoVenta      = dto.puntoVenta.padStart(4, '0');
    config.certificadoEnc  = this.cifrado.cifrar(dto.certificado);
    config.clavePrivadaEnc = this.cifrado.cifrar(dto.clavePrivada);
    config.ambiente        = dto.ambiente ?? 'testing';
    config.estado          = 'pendiente';
    // Invalidar ticket cacheado al cambiar credenciales
    config.ticketAccesoEnc  = null;
    config.ticketVencimiento = null;
    config.ultimoError       = null;

    const saved = await this.repo.save(config);
    return { ok: true, id: saved.id };
  }

  async getResumen(sucursalId: string): Promise<ResumenArcaConfig> {
    const config = await this.repo.findOne({ where: { sucursalId } });
    if (!config) return { configurado: false };

    return {
      configurado:   true,
      id:            config.id,
      sucursalId:    config.sucursalId,
      cuit:          config.cuit,
      puntoVenta:    config.puntoVenta,
      ambiente:      config.ambiente,
      estado:        config.estado,
      ticketVigente: this.ticketVigente(config),
      ultimoTest:    config.ultimoTest,
      ultimoError:   config.ultimoError,
      updatedAt:     config.updatedAt,
    };
  }

  async cambiarAmbiente(dto: CambiarAmbienteArcaDto): Promise<{ ok: boolean }> {
    const config = await this.getConfigOThrow(dto.sucursalId);
    config.ambiente          = dto.ambiente;
    config.estado            = 'pendiente';
    config.ticketAccesoEnc   = null;
    config.ticketVencimiento = null;
    await this.repo.save(config);
    return { ok: true };
  }

  // ── Test de conexión ──────────────────────────────────────────────────────

  async testConexion(sucursalId: string): Promise<{ ok: boolean; mensaje: string }> {
    const config = await this.getConfigOThrow(sucursalId);

    try {
      // Forzar renovación del ticket para validar cert+key contra AFIP
      config.ticketAccesoEnc  = null;
      config.ticketVencimiento = null;
      await this.wsaa.obtenerTicketAcceso(config, 'wsfe');

      config.estado    = 'activo';
      config.ultimoTest = new Date();
      config.ultimoError = null;
      await this.repo.save(config);

      return { ok: true, mensaje: 'Conexión con AFIP establecida correctamente' };
    } catch (err: unknown) {
      config.estado     = 'error';
      config.ultimoError = err instanceof Error ? err.message : String(err);
      await this.repo.save(config);
      throw new BadRequestException(`Error al conectar con AFIP: ${config.ultimoError}`);
    }
  }

  // ── Solicitud de CAE (llamada desde FacturacionService) ──────────────────

  /** Devuelve null si ARCA no está activo para la sucursal (modo manual) */
  async solicitarCAEParaVenta(
    sucursalId: string,
    solicitud: SolicitudCAE,
  ): Promise<RespuestaCAE | null> {
    const config = await this.repo.findOne({ where: { sucursalId } });
    if (!config || config.estado !== 'activo') return null;

    // Inyectar datos del emisor desde la configuración guardada
    const puntoVenta = Number(config.puntoVenta);
    const codigoCbte = this.codigoCbtePorTipo(solicitud.tipo);

    // La numeración fiscal la lleva AFIP, no el contador local: pedir el último
    // autorizado y avanzar uno no es atómico, así que dos emisiones simultáneas
    // pueden pedir el mismo número. AFIP rechaza el duplicado con error 10016;
    // ese caso se reintenta releyendo el último autorizado.
    return this.solicitarConReintento(config, solicitud, codigoCbte, puntoVenta);
  }

  /**
   * Serializa las solicitudes de CAE por sucursal. El lock es in-process: con
   * varias instancias del backend haría falta uno distribuido, pero el reintento
   * por error 10016 cubre igual ese caso.
   */
  private async solicitarConReintento(
    config: ArcaConfig,
    solicitud: SolicitudCAE,
    codigoCbte: number,
    puntoVenta: number,
    intentosRestantes = 3,
  ): Promise<RespuestaCAE> {
    const anterior = this.colaPorSucursal.get(config.sucursalId) ?? Promise.resolve();

    const ejecucion = anterior
      .catch(() => undefined) // un fallo previo no debe cortar la cadena
      .then(async () => {
        const ultimo = await this.wsfev1.ultimoComprobante(config, codigoCbte, puntoVenta);
        return this.wsfev1.solicitarCAE(config, {
          ...solicitud,
          codigoCbte, // explícito: las NC no lo pueden derivar de `tipo`
          cuit: config.cuit,
          puntoVenta,
          numero: ultimo + 1,
        });
      });

    this.colaPorSucursal.set(
      config.sucursalId,
      ejecucion.then(
        () => undefined,
        () => undefined,
      ),
    );

    try {
      return await ejecucion;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const numeroYaUsado = msg.includes('10016');

      if (numeroYaUsado && intentosRestantes > 1) {
        this.logger.warn(
          `Número de comprobante ya autorizado en AFIP (10016). Reintentando; ` +
            `quedan ${intentosRestantes - 1} intentos.`,
        );
        return this.solicitarConReintento(
          config,
          solicitud,
          codigoCbte,
          puntoVenta,
          intentosRestantes - 1,
        );
      }
      throw err;
    }
  }

  /**
   * CAE para una nota de crédito. La NC hereda la letra de la factura que
   * corrige (A→3, B→8, C→13) y debe declararla en CbtesAsoc.
   *
   * Devuelve null si ARCA no está activo o si el comprobante corregido no es
   * fiscal — una NC sobre un ticket interno no consume numeración de AFIP.
   */
  async solicitarCAEParaNotaCredito(
    sucursalId: string,
    solicitud: Omit<SolicitudCAE, 'tipo'> & {
      /** Código AFIP de la factura corregida (1, 6 u 11) */
      codigoFacturaOrigen: number;
      numeroFacturaOrigen: number;
      puntoVentaOrigen: number;
    },
  ): Promise<RespuestaCAE | null> {
    const config = await this.repo.findOne({ where: { sucursalId } });
    if (!config || config.estado !== 'activo') return null;

    const codigoNC = CODIGO_NOTA_CREDITO[solicitud.codigoFacturaOrigen];
    if (!codigoNC) return null; // el origen no era una factura fiscal

    const puntoVenta = Number(config.puntoVenta);

    return this.solicitarConReintento(
      config,
      {
        ...solicitud,
        tipo: TipoComprobante.NOTA_CREDITO,
        comprobanteAsociado: {
          tipo: solicitud.codigoFacturaOrigen,
          puntoVenta: solicitud.puntoVentaOrigen || puntoVenta,
          numero: solicitud.numeroFacturaOrigen,
          cuit: config.cuit,
        },
      },
      codigoNC,
      puntoVenta,
    );
  }

  private codigoCbtePorTipo(tipo: TipoComprobante): number {
    if (tipo === TipoComprobante.FACTURA_A) return 1;
    if (tipo === TipoComprobante.FACTURA_C) return 11;
    return 6; // B y Ticket
  }

  async estaActivo(sucursalId: string): Promise<boolean> {
    const config = await this.repo.findOne({ where: { sucursalId } });
    return config?.estado === 'activo';
  }

  /** Consulta último número autorizado para un tipo de comprobante */
  async ultimoNumeroAutorizado(
    sucursalId: string,
    tipo: TipoComprobante,
  ): Promise<{ numero: number }> {
    const config = await this.getConfigOThrow(sucursalId);
    const codigos: Partial<Record<TipoComprobante, number>> = {
      [TipoComprobante.FACTURA_A]: 1,
      [TipoComprobante.FACTURA_B]: 6,
      [TipoComprobante.FACTURA_C]: 11,
    };
    const codigo = codigos[tipo];
    if (!codigo) throw new BadRequestException('Tipo de comprobante no soportado para AFIP');

    const numero = await this.wsfev1.ultimoComprobante(
      config,
      codigo,
      Number(config.puntoVenta),
    );
    return { numero };
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  async getConfigOThrow(sucursalId: string): Promise<ArcaConfig> {
    const config = await this.repo.findOne({ where: { sucursalId } });
    if (!config) {
      throw new NotFoundException('No hay configuración ARCA para esta sucursal');
    }
    return config;
  }

  private ticketVigente(config: ArcaConfig): boolean {
    if (!config.ticketVencimiento) return false;
    return config.ticketVencimiento.getTime() - Date.now() > 5 * 60 * 1000;
  }
}
