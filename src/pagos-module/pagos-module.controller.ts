import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PagosModuleService } from './pagos-module.service';
import { CreatePagosModuleDto } from './dto/create-pagos-module.dto';
import { UpdatePagosModuleDto } from './dto/update-pagos-module.dto';

@Controller('pagos-module')
export class PagosModuleController {
  constructor(private readonly pagosModuleService: PagosModuleService) {}

  @Post()
  create(@Body() createPagosModuleDto: CreatePagosModuleDto) {
    return this.pagosModuleService.create(createPagosModuleDto);
  }

  @Get()
  findAll() {
    return this.pagosModuleService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pagosModuleService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePagosModuleDto: UpdatePagosModuleDto) {
    return this.pagosModuleService.update(+id, updatePagosModuleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pagosModuleService.remove(+id);
  }
}
