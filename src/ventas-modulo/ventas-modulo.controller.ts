import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { VentasModuloService } from './ventas-modulo.service';
import { CreateVentasModuloDto } from './dto/create-ventas-modulo.dto';
import { UpdateVentasModuloDto } from './dto/update-ventas-modulo.dto';

@Controller('ventas-modulo')
export class VentasModuloController {
  constructor(private readonly ventasModuloService: VentasModuloService) {}

  @Post()
  create(@Body() createVentasModuloDto: CreateVentasModuloDto) {
    return this.ventasModuloService.create(createVentasModuloDto);
  }

  @Get()
  findAll() {
    return this.ventasModuloService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ventasModuloService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateVentasModuloDto: UpdateVentasModuloDto,
  ) {
    return this.ventasModuloService.update(id, updateVentasModuloDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ventasModuloService.remove(id);
  }
}
