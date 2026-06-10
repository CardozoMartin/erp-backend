import { Body, Controller, Get, Param, Post, Request } from '@nestjs/common';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';
import { CreateNotaCreditoDto } from './dto/create-nota-credito.dto';
import { NotasCreditoService } from './notas-credito.service';

@Controller('notas-credito')
export class NotasCreditoController {
  constructor(private readonly notasCreditoService: NotasCreditoService) {}

  @Post()
  @RequierePermiso('ventas.cancelar.pagada')
  create(
    @SucursalActiva() sucursalId: string,
    @Request() req,
    @Body() dto: CreateNotaCreditoDto,
  ) {
    return this.notasCreditoService.create(sucursalId, req.user.id, dto);
  }

  @Get()
  @RequierePermiso('ventas.ver')
  findAll(@SucursalActiva() sucursalId: string) {
    return this.notasCreditoService.findAll(sucursalId);
  }

  @Get('origen/:comprobanteId')
  @RequierePermiso('ventas.ver')
  findByOrigen(
    @Param('comprobanteId') comprobanteId: string,
    @SucursalActiva() sucursalId: string,
  ) {
    return this.notasCreditoService.findByOrigen(sucursalId, comprobanteId);
  }
}
