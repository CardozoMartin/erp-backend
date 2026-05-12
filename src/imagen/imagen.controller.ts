import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ImagenService } from './imagen.service';
import { CreateImagenDto } from './dto/create-imagen.dto';
import { UpdateImagenDto } from './dto/update-imagen.dto';

@Controller('imagen')
export class ImagenController {
  constructor(private readonly imagenService: ImagenService) {}

  @Post()
  create(@Body() createImagenDto: CreateImagenDto) {
    return this.imagenService.create(createImagenDto);
  }

  @Get()
  findAll() {
    return this.imagenService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.imagenService.findOneOrFail(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateImagenDto: UpdateImagenDto) {
    return this.imagenService.update(id, updateImagenDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.imagenService.remove(id);
  }
}
