import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermisosGuard } from 'src/auth/guards/permisos.guard';
import { MercadopagoService } from './mercadopago.service';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { GuardarMpDto } from './dto/guardar-mp.dto';
import { CajaService } from 'src/caja/caja.service';
import {
  BuscarMpStoreDto,
  BuscarMpPosDto,
  CrearMpPosDto,
  CrearMpStoreDto,
  MpAccessTokenDto,
} from './dto/mp-onboarding.dto';

@Controller(['mp', 'mercadopago'])
@UseGuards(JwtAuthGuard, PermisosGuard)
export class MercadopagoController {
  constructor(
    private readonly mercadopagoService: MercadopagoService,
    private readonly cajaService: CajaService,
  ) {}

  // ── POST /mp/credenciales  (vos lo llamás desde Postman en fase 1)
  @Post('credenciales')
  @RequierePermiso('mp.crear')
  guardar(@Body() dto: GuardarMpDto) {
    return this.mercadopagoService.guardarCredenciales(dto);
  }

  @Post('usuario')
  @RequierePermiso('mp.crear')
  usuario(@Body() dto: MpAccessTokenDto) {
    return this.mercadopagoService.obtenerUsuario(dto.accessToken);
  }

  @Post('stores')
  @RequierePermiso('mp.crear')
  crearStore(@Body() dto: CrearMpStoreDto) {
    return this.mercadopagoService.crearStore(dto);
  }

  @Post('stores/buscar')
  @RequierePermiso('mp.crear')
  buscarStore(@Body() dto: BuscarMpStoreDto) {
    return this.mercadopagoService.buscarStore(dto);
  }

  @Post('pos')
  @RequierePermiso('mp.crear')
  crearPos(@Body() dto: CrearMpPosDto) {
    return this.mercadopagoService.crearPos(dto);
  }

  @Post('pos/buscar')
  @RequierePermiso('mp.crear')
  buscarPos(@Body() dto: BuscarMpPosDto) {
    return this.mercadopagoService.buscarPos(dto);
  }

  // ── GET /mp/test/:sucursalId  (verificás que funciona antes de activar)
  @Get('test/:sucursalId')
  @RequierePermiso('mp.leer')
  test(@Param('sucursalId') sucursalId: string) {
    return this.mercadopagoService.testConexion(sucursalId);
  }

  // ── GET /mp/estado/:sucursalId  (para mostrar en el panel)
  @Get('estado/:sucursalId')
  @RequierePermiso('mp.leer')
  async estado(@Param('sucursalId') sucursalId: string) {
    return this.mercadopagoService.getResumenConfiguracion(sucursalId);
  }

  @Post('qr/orden')
  @RequierePermiso('mp.crear')
  crearOrdenQr(
    @Body()
    dto: {
      sucursalId: string;
      ventaId: string;
      cajaId: string;
      total: number;
      items: {
        titulo: string;
        cantidad: number;
        precioUnitario: number;
      }[];
    },
  ) {
    const { sucursalId, ...datos } = dto;
    return this.mercadopagoService.crearOrdenQR(sucursalId, datos);
  }

  @Post('qr/cancelar')
  @RequierePermiso('mp.crear')
  async cancelarOrdenQr(@Body() dto: { sucursalId: string }) {
    await this.mercadopagoService.cancelarOrdenQR(dto.sucursalId);
    return { ok: true };
  }

  @Get('qr/estado/:sucursalId/:ventaId')
  @RequierePermiso('caja.cobrar')
  async estadoOrdenQr(
    @Param('sucursalId') sucursalId: string,
    @Param('ventaId') ventaId: string,
  ) {
    const estado = await this.mercadopagoService.consultarPagoPorReferencia(
      sucursalId,
      ventaId,
    );

    if (estado.ok && estado.mpPaymentId && estado.monto != null) {
      await this.cajaService.confirmarPagoMercadoPago({
        ventaId,
        mpPaymentId: estado.mpPaymentId,
        monto: estado.monto,
        medioPago: estado.medioPago ?? 'mercadopago',
        sucursalId,
      });
    }

    return estado;
  }
}
