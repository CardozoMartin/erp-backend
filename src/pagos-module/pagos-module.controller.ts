import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { PagosModuleService } from './pagos-module.service';
import { CrearMedioPagoDto } from './dto/create-pagos-module.dto';
import { UpdatePagosModuleDto } from './dto/update-pagos-module.dto';

@Controller('pagos')
export class PagosModuleController {
  constructor(private readonly pagosModuleService: PagosModuleService) {}

  @Post()
  create(@Body() dto: CrearMedioPagoDto) {
    return this.pagosModuleService.create(dto);
  }

  @Get()
  findAll() {
    return this.pagosModuleService.findAll();
  }

  @Get('activos')
  findActivos() {
    return this.pagosModuleService.findActivos();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pagosModuleService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePagosModuleDto) {
    return this.pagosModuleService.update(id, dto);
  }

  @Patch(':id/toggle')
  toggleActivo(@Param('id') id: string) {
    return this.pagosModuleService.toggleActivo(id);
  }
}
