import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Request,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { CreateConfiguracionDto } from './dto/create-configuracion.dto';
import { UpdateConfiguracionDto } from './dto/update-configuracion.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
@UseGuards(JwtAuthGuard)
@Controller('configuracion')
export class ConfiguracionController {
  private readonly logger = new Logger('ConfigPOSDebug');

  constructor(private readonly configuracionService: ConfiguracionService) {}

  @Post()
  create(@Body() dto: CreateConfiguracionDto, @Request() req) {
    this.logger.log(`POST /configuracion body=${JSON.stringify(dto)}`);
    return this.configuracionService.create(dto, req.user?.id);
  }

  @Get(':sucursalId')
  findBySucursal(@Param('sucursalId') sucursalId: string) {
    this.logger.log(`GET /configuracion/${sucursalId}`);
    return this.configuracionService.findBySucursal(sucursalId);
  }

  @Patch(':sucursalId')
  update(
    @Param('sucursalId') sucursalId: string,
    @Body() dto: UpdateConfiguracionDto,
    @Request() req,
  ) {
    this.logger.log(
      `PATCH /configuracion/${sucursalId} body=${JSON.stringify(dto)}`,
    );
    return this.configuracionService.update(sucursalId, dto, req.user?.id);
  }
}
