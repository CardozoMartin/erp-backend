import { Body, Controller, Get, Param, Patch, Post, Request } from '@nestjs/common';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';
import {
  AnularComprobanteFiscalDto,
  EmitirComprobanteFiscalDto,
} from './dto/emitir-comprobante-fiscal.dto';
import { FacturacionService } from './facturacion.service';

@Controller('facturacion')
export class FacturacionController {
  constructor(private readonly facturacionService: FacturacionService) {}

  @Post('emitir')
  @RequierePermiso('caja.cobrar')
  emitir(
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: EmitirComprobanteFiscalDto,
  ) {
    return this.facturacionService.emitir(sucursalId, req.user.id, dto);
  }

  @Get('origen/:ventaId')
  @RequierePermiso('ventas.ver')
  findByVenta(
    @Param('ventaId') ventaId: string,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.facturacionService.findByVenta(sucursalId, ventaId);
  }

  @Get()
  @RequierePermiso('ventas.ver')
  findAll(@SucursalActiva() sucursalId: string) {
    return this.facturacionService.findAll(sucursalId);
  }

  @Patch(':id/anular')
  @RequierePermiso('ventas.cancelar.pagada')
  anular(
    @Param('id') id: string,
    @SucursalActiva() sucursalId: string,
    @Body() dto: AnularComprobanteFiscalDto,
  ) {
    return this.facturacionService.anular(id, sucursalId, dto);
  }
}
