import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, Request } from '@nestjs/common';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';
import { CobrarComprobanteDto } from './dto/create-pago-pos.dto';
import { PagosPosService } from './pagos-pos.service';

@ApiTags('pagos-pos')
@ApiBearerAuth('JWT')
@Controller('pagos-pos')
export class PagosPosController {
  constructor(private readonly pagosPosService: PagosPosService) {}

  @Post('comprobantes/:comprobanteId/cobrar')
  @RequierePermiso('caja.cobrar')
  cobrar(
    @Param('comprobanteId') comprobanteId: string,
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: CobrarComprobanteDto,
  ) {
    return this.pagosPosService.cobrar(
      comprobanteId,
      sucursalId,
      req.user.id,
      dto,
    );
  }

  @Get('comprobantes/:comprobanteId')
  @RequierePermiso('caja.ver')
  findByComprobante(@Param('comprobanteId') comprobanteId: string) {
    return this.pagosPosService.findByComprobante(comprobanteId);
  }
}
