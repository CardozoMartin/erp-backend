import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { SucursalService } from './sucursal.service';
import {
  CreateSucursalDto,
  UpdateSucursalDto,
} from './dto/create-sucursal.dto';

@Controller('sucursales')
export class SucursalController {
  constructor(private readonly sucursalService: SucursalService) {}

  @Get()
  findAll() {
    return this.sucursalService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sucursalService.findOne(id);
  }

  @Post()
  create(@Body() createSucursalDto: CreateSucursalDto) {
    return this.sucursalService.create(createSucursalDto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSucursalDto: UpdateSucursalDto,
  ) {
    return this.sucursalService.update(id, updateSucursalDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sucursalService.remove(id);
  }
}
