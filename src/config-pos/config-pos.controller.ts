// config-pos/config-pos.controller.ts
import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ConfigPosService } from './config-pos.service';
import { ConfigPosDto } from './dto/create-config-po.dto';

@Controller('config-pos')
export class ConfigPosController {
  constructor(private readonly configPosService: ConfigPosService) {}

  // GET /config-pos/sucursal/:sucursalId
  @Get('sucursal/:sucursalId')
  findBySucursal(@Param('sucursalId') sucursalId: string) {
    return this.configPosService.findBySucursal(sucursalId);
  }

  // PATCH /config-pos/sucursal/:sucursalId
  @Patch('sucursal/:sucursalId')
  update(@Param('sucursalId') sucursalId: string, @Body() dto: ConfigPosDto) {
    return this.configPosService.update(sucursalId, dto);
  }
}
