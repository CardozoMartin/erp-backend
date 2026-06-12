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
import { ConfiguracionEmailService } from './configuracion-email.service';
import { ConfiguracionServiciosService } from './configuracion-servicios.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { CreateConfiguracionDto } from './dto/create-configuracion.dto';
import { UpsertConfiguracionCloudinaryDto } from 'src/cloudinary/dto/configuracion-cloudinary.dto';
import {
  ProbarConfiguracionEmailDto,
  UpsertConfiguracionEmailDto,
} from './dto/configuracion-email.dto';
import { UpdateConfiguracionDto } from './dto/update-configuracion.dto';
import {
  RequiereAlgunoPermiso,
} from 'src/auth/decorators/requiere-permiso.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SucursalActiva } from 'src/sucursal/decorators/sucursales-activas.decorator';
@UseGuards(JwtAuthGuard)
@Controller('configuracion')
export class ConfiguracionController {
  private readonly logger = new Logger('ConfigPOSDebug');

  constructor(
    private readonly configuracionService: ConfiguracionService,
    private readonly configuracionEmailService: ConfiguracionEmailService,
    private readonly configuracionServiciosService: ConfiguracionServiciosService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @RequiereAlgunoPermiso('admin.servicios', 'config.pos')
  create(@Body() dto: CreateConfiguracionDto, @Request() req) {
    this.logger.log(`POST /configuracion body=${JSON.stringify(dto)}`);
    return this.configuracionService.create(dto, req.user?.id);
  }

  @Get('servicios/estado')
  estadoServicios(@SucursalActiva() sucursalId: string) {
    return this.configuracionServiciosService.getEstadoServicios(sucursalId);
  }

  @Get(':sucursalId')
  @RequiereAlgunoPermiso('admin.servicios', 'config.pos')
  findBySucursal(@Param('sucursalId') sucursalId: string) {
    this.logger.log(`GET /configuracion/${sucursalId}`);
    return this.configuracionService.findBySucursal(sucursalId);
  }

  @Patch(':sucursalId')
  @RequiereAlgunoPermiso('admin.servicios', 'config.pos')
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

  @Get('email/:sucursalId')
  @RequiereAlgunoPermiso('admin.servicios', 'config.email')
  findEmailBySucursal(@Param('sucursalId') sucursalId: string) {
    return this.configuracionEmailService.findBySucursal(sucursalId);
  }

  @Post('email/:sucursalId')
  @RequiereAlgunoPermiso('admin.servicios', 'config.email')
  upsertEmail(
    @Param('sucursalId') sucursalId: string,
    @Body() dto: UpsertConfiguracionEmailDto,
    @Request() req,
  ) {
    return this.configuracionEmailService.upsert(sucursalId, dto, req.user?.id);
  }

  @Post('email/:sucursalId/probar')
  @RequiereAlgunoPermiso('admin.servicios', 'config.email')
  probarEmail(
    @Param('sucursalId') sucursalId: string,
    @Body() dto: ProbarConfiguracionEmailDto,
    @Request() req,
  ) {
    return this.configuracionEmailService.probar(sucursalId, dto, req.user?.id);
  }

  @Get('cloudinary/:sucursalId')
  @RequiereAlgunoPermiso('admin.servicios', 'config.pos')
  findCloudinaryBySucursal(@Param('sucursalId') sucursalId: string) {
    return this.cloudinaryService.findBySucursal(sucursalId);
  }

  @Post('cloudinary/:sucursalId')
  @RequiereAlgunoPermiso('admin.servicios', 'config.pos')
  upsertCloudinary(
    @Param('sucursalId') sucursalId: string,
    @Body() dto: UpsertConfiguracionCloudinaryDto,
    @Request() req,
  ) {
    return this.cloudinaryService.upsert(sucursalId, dto, req.user?.id);
  }

  @Post('cloudinary/:sucursalId/probar')
  @RequiereAlgunoPermiso('admin.servicios', 'config.pos')
  probarCloudinary(@Param('sucursalId') sucursalId: string, @Request() req) {
    return this.cloudinaryService.probar(sucursalId, req.user?.id);
  }
}
