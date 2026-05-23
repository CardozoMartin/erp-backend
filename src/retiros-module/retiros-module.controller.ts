import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { RetirosModuleService } from './retiros-module.service';
import { CreateRetirosModuleDto } from './dto/create-retiros-module.dto';
import { UpdateRetirosModuleDto } from './dto/update-retiros-module.dto';

@Controller('retiros-module')
export class RetirosModuleController {
  constructor(private readonly retirosModuleService: RetirosModuleService) {}

  @Post()
  create(@Body() createRetirosModuleDto: CreateRetirosModuleDto) {
    return this.retirosModuleService.create(createRetirosModuleDto);
  }

  @Get()
  findAll() {
    return this.retirosModuleService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.retirosModuleService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRetirosModuleDto: UpdateRetirosModuleDto) {
    return this.retirosModuleService.update(+id, updateRetirosModuleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.retirosModuleService.remove(+id);
  }
}
