import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';

interface MpWebhookBody {
  data?: { id?: string | number };
  type?: string;
  topic?: string;
  user_id?: string | number;
}

interface MpPago {
  status: string;
  external_reference?: string;
  transaction_amount?: number;
  total_paid_amount?: number;
  payment_type_id?: string;
  id?: string | number;
  payments?: Array<MpPago>;
}
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';
import { MercadopagoService } from './mercadopago.service';
import { CajaService } from '../caja/caja.service';
import { Publico } from '../auth/decorators/publico.decorator';

@Controller('webhooks')
export class MpWebhookController {
  constructor(
    private readonly mpService: MercadopagoService,
    private readonly cajaService: CajaService,
    private readonly config: ConfigService,
  ) {}

  @Post('mp')
  @Publico()
  @HttpCode(200)
  async recibirNotificacion(
    @Body() body: MpWebhookBody,
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
    @Query('data.id') dataId: string,
    @Query() query: Record<string, string>,
  ) {
    const notificationId =
      body.data?.id?.toString() || dataId || query.id?.toString() || '';
    if (!notificationId) return { ok: true };

    const esValido = this.validarFirma(xSignature, xRequestId, notificationId);
    if (!esValido) throw new BadRequestException('Firma invalida');

    const tipo = body.type || body.topic || query.type || query.topic;
    const userId = body.user_id?.toString() || query.user_id?.toString();
    const mpConfig = userId
      ? await this.mpService.getConfigPorPosId(userId)
      : null;
    if (!mpConfig) return { ok: true };

    const token = this.mpService.descifrarToken(mpConfig);

    if (tipo === 'payment') {
      const { data: pago } = await axios.get(
        `https://api.mercadopago.com/v1/payments/${notificationId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await this.confirmarPagoSiAprobado(
        pago,
        notificationId,
        mpConfig.sucursalId,
      );
      return { ok: true };
    }

    if (tipo === 'merchant_order' || tipo === 'merchant_orders') {
      const { data: orden } = await axios.get(
        `https://api.mercadopago.com/merchant_orders/${notificationId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const pago = orden.payments?.find((item) => item.status === 'approved');
      if (!pago) return { ok: true };

      await this.confirmarPagoSiAprobado(
        {
          ...pago,
          external_reference: orden.external_reference,
        },
        pago.id?.toString() || notificationId,
        mpConfig.sucursalId,
      );
    }

    return { ok: true };
  }

  private async confirmarPagoSiAprobado(
    pago: MpPago,
    paymentId: string,
    sucursalId: string,
  ) {
    if (pago.status !== 'approved') return;
    if (!pago.external_reference) return;

    await this.cajaService.confirmarPagoMercadoPago({
      ventaId: pago.external_reference,
      mpPaymentId: paymentId,
      monto: Number(pago.transaction_amount ?? pago.total_paid_amount ?? 0),
      medioPago: pago.payment_type_id || 'mercadopago',
      sucursalId,
    });
  }

  private validarFirma(
    xSignature: string,
    xRequestId: string,
    dataId: string,
  ): boolean {
    const secret = this.config.get<string>('MP_WEBHOOK_SECRET');
    if (!secret || !xSignature) return false;

    const partes = Object.fromEntries(
      xSignature.split(',').map((parte) => parte.split('=')),
    );
    const ts = partes.ts;
    const v1 = partes.v1;
    if (!ts || !v1) return false;

    const mensaje = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const firma = crypto
      .createHmac('sha256', secret)
      .update(mensaje)
      .digest('hex');

    if (firma.length !== v1.length) return false;
    return crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(v1));
  }
}
