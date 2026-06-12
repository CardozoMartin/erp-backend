// lista-precio/lista-precio.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ListaPrecioService } from './lista-precio.service';
import { CreateListaPrecioDto } from './dto/create-lista-precio.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RequierePermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { SucursalGuard } from 'src/sucursal/decorators/sucursal.guard';

@UseGuards(JwtAuthGuard, SucursalGuard)
@Controller('listas-precio')
export class ListaPrecioController {
  constructor(private readonly service: ListaPrecioService) {}

  @Post()
  @RequierePermiso('precios.crear')
  create(@Request() req, @Body() dto: CreateListaPrecioDto) {
    return this.service.create(dto, req.user.sucursalId);
  }

  @Get()
  @RequierePermiso('precios.ver')
  findAll(@Request() req, @Query('includeInactive') includeInactive?: string) {
    // Traer globales + las de la sucursal activa del token
    return this.service.findAll(
      req.user.sucursalId,
      includeInactive === 'true',
    );
  }

  @Get(':id')
  @RequierePermiso('precios.ver')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequierePermiso('precios.editar')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: Partial<CreateListaPrecioDto>,
  ) {
    return this.service.update(id, dto, req.user.sucursalId);
  }

  @Delete(':id')
  @RequierePermiso('precios.eliminar')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
