import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MpConfig } from './entities/mp-config.entity';
import axios from 'axios';
import { MpCifradoService } from './mp-cifrado.service';
import { GuardarMpDto } from './dto/guardar-mp.dto';
import {
  BuscarMpStoreDto,
  BuscarMpPosDto,
  CrearMpPosDto,
  CrearMpStoreDto,
} from './dto/mp-onboarding.dto';
@Injectable()
export class MercadopagoService {
  private readonly mpBaseUrl = 'https://api.mercadopago.com';

  constructor(
    @InjectRepository(MpConfig)
    private repo: Repository<MpConfig>,
    private cifrado: MpCifradoService,
    private config: ConfigService,
  ) {}

  // ── Etapa 1: guardar credenciales cifradas ──────────────────────────────
  async guardarCredenciales(
    dto: GuardarMpDto,
  ): Promise<{ ok: boolean; id: string }> {
    // Si ya existe config para esta sucursal, la reemplazamos
    let mpConfig = await this.repo.findOne({
      where: { sucursalId: dto.sucursalId },
    });

    if (!mpConfig) {
      mpConfig = this.repo.create();
    }

    mpConfig.sucursalId = dto.sucursalId;
    mpConfig.accessTokenEnc = this.cifrado.cifrar(dto.accessToken);
    mpConfig.mpUserId = dto.mpUserId;
    mpConfig.mpPosId = dto.mpPosId;
    mpConfig.mpPosNombre = dto.mpPosNombre ?? '';
    mpConfig.estado = 'pendiente'; // requiere test antes de activar

    const guardado = await this.repo.save(mpConfig);
    return { ok: true, id: guardado.id };
  }

  async getResumenConfiguracion(sucursalId: string): Promise<{
    configurado: boolean;
    id?: string;
    sucursalId?: string;
    estado?: string;
    mpUserId?: string;
    mpPosId?: string;
    mpPosNombre?: string;
    ultimoTest?: Date | null;
    ultimoError?: string | null;
    updatedAt?: Date;
  }> {
    const mpConfig = await this.repo.findOne({ where: { sucursalId } });
    if (!mpConfig) return { configurado: false };

    return {
      configurado: true,
      id: mpConfig.id,
      sucursalId: mpConfig.sucursalId,
      estado: mpConfig.estado,
      mpUserId: mpConfig.mpUserId,
      mpPosId: mpConfig.mpPosId,
      mpPosNombre: mpConfig.mpPosNombre,
      ultimoTest: mpConfig.ultimoTest,
      ultimoError: mpConfig.ultimoError,
      updatedAt: mpConfig.updatedAt,
    };
  }

  async obtenerUsuario(accessToken: string) {
    try {
      const { data } = await axios.get(`${this.mpBaseUrl}/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      return {
        id: data.id,
        nickname: data.nickname,
        email: data.email,
        site_id: data.site_id,
        status: data.status?.site_status,
      };
    } catch (err: unknown) {
      throw new BadRequestException({
        message: this.obtenerMensajeErrorMp(err),
        detalle: axios.isAxiosError(err) ? err.response?.data : undefined,
      });
    }
  }

  async crearStore(dto: CrearMpStoreDto) {
    try {
      const { data } = await axios.post(
        `${this.mpBaseUrl}/users/${dto.userId}/stores`,
        {
          name: dto.name,
          business_hours: dto.businessHours,
          location: dto.location,
          external_id: dto.externalId,
        },
        { headers: { Authorization: `Bearer ${dto.accessToken}` } },
      );

      return data;
    } catch (err: unknown) {
      throw new BadRequestException({
        message: this.obtenerMensajeErrorMp(err),
        detalle: axios.isAxiosError(err) ? err.response?.data : undefined,
      });
    }
  }

  async buscarStore(dto: BuscarMpStoreDto) {
    try {
      const { data } = await axios.get(
        `${this.mpBaseUrl}/users/${dto.userId}/stores/search`,
        {
          headers: { Authorization: `Bearer ${dto.accessToken}` },
          params: { external_id: dto.externalId },
        },
      );

      return data;
    } catch (err: unknown) {
      throw new BadRequestException({
        message: this.obtenerMensajeErrorMp(err),
        detalle: axios.isAxiosError(err) ? err.response?.data : undefined,
      });
    }
  }

  async crearPos(dto: CrearMpPosDto) {
    try {
      const { data } = await axios.post(
        `${this.mpBaseUrl}/pos`,
        {
          name: dto.name,
          fixed_amount: dto.fixedAmount,
          store_id: dto.storeId,
          external_store_id: dto.externalStoreId,
          external_id: dto.externalId,
          category: dto.category,
        },
        { headers: { Authorization: `Bearer ${dto.accessToken}` } },
      );

      return data;
    } catch (err: unknown) {
      throw new BadRequestException({
        message: this.obtenerMensajeErrorMp(err),
        detalle: axios.isAxiosError(err) ? err.response?.data : undefined,
      });
    }
  }

  async buscarPos(dto: BuscarMpPosDto) {
    try {
      const { data } = await axios.get(`${this.mpBaseUrl}/pos`, {
        headers: { Authorization: `Bearer ${dto.accessToken}` },
        params: { external_id: dto.externalId },
      });

      return data;
    } catch (err: unknown) {
      throw new BadRequestException({
        message: this.obtenerMensajeErrorMp(err),
        detalle: axios.isAxiosError(err) ? err.response?.data : undefined,
      });
    }
  }

  // ── Etapa 2: test de conexión real contra MP API ────────────────────────
  async testConexion(sucursalId: string): Promise<{
    ok: boolean;
    estado: string;
    mpUser?: string;
    posNombre?: string;
    error?: string;
  }> {
    const mpConfig = await this.repo.findOne({ where: { sucursalId } });
    if (!mpConfig)
      throw new NotFoundException(
        'No hay configuración Mercado Pago guardada para esta sucursal. Cree o busque el POS y guarde la configuración antes de probar.',
      );

    const token = this.cifrado.descifrar(mpConfig.accessTokenEnc);

    type MpUserResponse = {
      id?: number;
      nickname?: string;
      email?: string;
    };

    type MpPosSearchResponse = {
      results?: {
        id?: number;
        user_id?: number;
        name?: string;
        external_id?: string;
      }[];
    };

    try {
      // Test 1: validar que el token es válido
      const { data: user } = await axios.get<MpUserResponse>(
        `${this.mpBaseUrl}/users/me`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const userId = user.id?.toString();
      if (userId && mpConfig.mpUserId && userId !== mpConfig.mpUserId) {
        throw new Error(`mp_user_id_mismatch:${userId}`);
      }

      // Test 2: validar que el POS existe por external_id y pertenece a este usuario
      const { data: posSearch } = await axios.get<MpPosSearchResponse>(
        `${this.mpBaseUrl}/pos`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { external_id: mpConfig.mpPosId },
        },
      );
      const pos = posSearch.results?.[0];
      if (!pos) throw new Error('pos_not_found');
      if (user.id && pos.user_id && user.id !== pos.user_id) {
        throw new Error(`pos_user_mismatch:${pos.user_id}`);
      }

      // Todo OK → marcamos como activo
      mpConfig.estado = 'activo';
      mpConfig.ultimoTest = new Date();
      mpConfig.ultimoError = null;
      await this.repo.save(mpConfig);

      return {
        ok: true,
        estado: 'activo',
        mpUser: user.nickname || user.email,
        posNombre: pos.name,
      };
    } catch (err: unknown) {
      const mensaje = this.obtenerMensajeErrorMp(err);

      mpConfig.estado = 'error';
      mpConfig.ultimoTest = new Date();
      mpConfig.ultimoError = mensaje;
      await this.repo.save(mpConfig);

      return {
        ok: false,
        estado: 'error',
        error: mensaje,
      };
    }
  }

  // ── Helper interno para otros módulos (Cajas, Ventas) ──────────────────
  async consultarPagoPorReferencia(
    sucursalId: string,
    ventaId: string,
  ): Promise<{
    ok: boolean;
    estado: 'pendiente' | 'aprobado' | 'error';
    mpPaymentId?: string;
    monto?: number;
    medioPago?: string;
    error?: string;
  }> {
    const config = await this.getConfigActiva(sucursalId);
    const token = this.cifrado.descifrar(config.accessTokenEnc);

    try {
      const { data } = await axios.get<{
        results?: {
          id?: number | string;
          status?: string;
          external_reference?: string;
          transaction_amount?: number;
          payment_type_id?: string;
        }[];
      }>(`${this.mpBaseUrl}/v1/payments/search`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          external_reference: ventaId,
          sort: 'date_created',
          criteria: 'desc',
        },
      });

      const aprobado = data.results?.find(
        (pago) =>
          pago.status === 'approved' && pago.external_reference === ventaId,
      );

      if (!aprobado?.id) {
        return { ok: false, estado: 'pendiente' };
      }

      return {
        ok: true,
        estado: 'aprobado',
        mpPaymentId: aprobado.id.toString(),
        monto: Number(aprobado.transaction_amount ?? 0),
        medioPago: aprobado.payment_type_id ?? 'mercadopago',
      };
    } catch (err: unknown) {
      return {
        ok: false,
        estado: 'error',
        error: this.obtenerMensajeErrorMp(err),
      };
    }
  }

  private obtenerMensajeErrorMp(err: unknown): string {
    if (!axios.isAxiosError<{ message?: string; error?: string }>(err)) {
      return err instanceof Error ? err.message : String(err);
    }

    const status = err.response?.status;
    const data = err.response?.data;
    const detalle = data?.message || data?.error || err.message;
    const mensaje = detalle?.trim();

    if (mensaje) return mensaje;
    if (status === 401) return 'invalid_token';
    if (status === 404) return 'pos_not_found';
    return 'mercadopago_error';
  }

  async getTokenActivo(sucursalId: string): Promise<string> {
    const mpConfig = await this.repo.findOne({ where: { sucursalId } });
    if (!mpConfig || mpConfig.estado !== 'activo') {
      throw new BadRequestException(
        'Mercado Pago no está configurado o activo para esta sucursal',
      );
    }
    return this.cifrado.descifrar(mpConfig.accessTokenEnc);
  }

  async getConfigActiva(sucursalId: string): Promise<MpConfig> {
    const mpConfig = await this.repo.findOne({ where: { sucursalId } });
    if (!mpConfig || mpConfig.estado !== 'activo') {
      throw new BadRequestException(
        'Mercado Pago no está activo para esta sucursal',
      );
    }
    return mpConfig;
  }

  // ── Crear orden en el QR estático del POS ──────────────────────────────
  async crearOrdenQR(
    sucursalId: string,
    datos: {
      ventaId: string;
      cajaId: string;
      total: number;
      items: {
        titulo: string;
        cantidad: number;
        precioUnitario: number;
      }[];
    },
  ): Promise<{
    externalReference: string;
    posNombre?: string;
    qr?: {
      image?: string;
      template_document?: string;
      template_image?: string;
    };
    qrCode?: string;
  }> {
    const config = await this.getConfigActiva(sucursalId);
    const token = this.cifrado.descifrar(config.accessTokenEnc);

    const externalReference = datos.ventaId; // tu ID de venta como referencia

    const body = {
      external_reference: externalReference,
      title: `Venta #${datos.ventaId}`,
      description: `Caja ${datos.cajaId}`,
      total_amount: datos.total,
      items: datos.items.map((i) => ({
        title: i.titulo,
        quantity: i.cantidad,
        unit_price: i.precioUnitario,
        unit_measure: 'unit',
        total_amount: i.cantidad * i.precioUnitario,
      })),
      cash_out: { amount: 0 },
      notification_url: this.obtenerNotificationUrl(),
    };

    await axios.put(
      `${this.mpBaseUrl}/instore/orders/qr/seller/collectors/${config.mpUserId}/pos/${config.mpPosId}/qrs`,
      body,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const pos = await this.obtenerPosActivo(config, token);
    return {
      externalReference,
      posNombre: pos?.name ?? config.mpPosNombre,
      qr: pos?.qr,
      qrCode: pos?.qr_code,
    };
  }

  // ── Eliminar la orden del QR (si el cajero cancela antes de que paguen) ──
  async cancelarOrdenQR(sucursalId: string): Promise<void> {
    const config = await this.getConfigActiva(sucursalId);
    const token = this.cifrado.descifrar(config.accessTokenEnc);

    await axios.delete(
      `${this.mpBaseUrl}/instore/orders/qr/seller/collectors/${config.mpUserId}/pos/${config.mpPosId}/qrs`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }

  async getConfigPorPosId(mpUserId: string): Promise<MpConfig | null> {
    return this.repo.findOne({ where: { mpUserId, estado: 'activo' } });
  }

  private obtenerNotificationUrl(): string | undefined {
    const explicit = this.config.get<string>('MP_NOTIFICATION_URL');
    if (explicit?.trim()) return explicit.trim();

    const publicBackendUrl = this.config.get<string>('PUBLIC_BACKEND_URL');
    if (!publicBackendUrl?.trim()) return undefined;

    return `${publicBackendUrl.replace(/\/$/, '')}/webhooks/mp`;
  }

  private async obtenerPosActivo(config: MpConfig, token: string): Promise<{
    name?: string;
    qr?: {
      image?: string;
      template_document?: string;
      template_image?: string;
    };
    qr_code?: string;
  } | null> {
    try {
      const { data } = await axios.get<{
        results?: {
          name?: string;
          qr?: {
            image?: string;
            template_document?: string;
            template_image?: string;
          };
          qr_code?: string;
        }[];
      }>(`${this.mpBaseUrl}/pos`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { external_id: config.mpPosId },
      });
      return data.results?.[0] ?? null;
    } catch {
      return null;
    }
  }

  // Lo hacemos público solo para uso interno entre módulos del mismo contexto
  descifrarToken(config: MpConfig): string {
    return this.cifrado.descifrar(config.accessTokenEnc);
  }
}
