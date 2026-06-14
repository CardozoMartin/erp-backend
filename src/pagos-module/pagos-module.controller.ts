import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { PagosModuleService } from './pagos-module.service';
import { CrearMedioPagoDto } from './dto/create-pagos-module.dto';
import { UpdatePagosModuleDto } from './dto/update-pagos-module.dto';

@Controller('pagos')
export class PagosModuleController {
  constructor(private readonly pagosModuleService: PagosModuleService) {}

  @Post()
  @RequierePermiso('medios_pago.crear')
  create(@Body() dto: CrearMedioPagoDto) {
    return this.pagosModuleService.create(dto);
  }

  @Get()
  @RequierePermiso('medios_pago.ver')
  findAll() {
    return this.pagosModuleService.findAll();
  }

  @Get('activos')
  @RequierePermiso('medios_pago.ver')
  findActivos() {
    return this.pagosModuleService.findActivos();
  }

  @Get(':id')
  @RequierePermiso('medios_pago.ver')
  findOne(@Param('id') id: string) {
    return this.pagosModuleService.findOne(id);
  }

  @Patch(':id')
  @RequierePermiso('medios_pago.editar')
  update(@Param('id') id: string, @Body() dto: UpdatePagosModuleDto) {
    return this.pagosModuleService.update(id, dto);
  }

  @Patch(':id/toggle')
  @RequierePermiso('medios_pago.editar')
  toggleActivo(@Param('id') id: string) {
    return this.pagosModuleService.toggleActivo(id);
  }
}
