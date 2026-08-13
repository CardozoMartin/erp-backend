import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermisosGuard } from 'src/auth/guards/permisos.guard';
import { RequiereAlgunoPermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { ArcaService } from './arca.service';
import {
  CambiarAmbienteArcaDto,
  GuardarArcaDto,
  TestArcaDto,
} from './dto/guardar-arca.dto';
import { TipoComprobante } from 'src/comprobantes/entities/comprobante.entity';

@ApiTags('arca')
@ApiBearerAuth('JWT')
@Controller('arca')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class ArcaController {
  constructor(private readonly arcaService: ArcaService) {}

  /** Guarda (o reemplaza) las credenciales ARCA de una sucursal */
  @Post('credenciales')
  @RequiereAlgunoPermiso('admin.servicios')
  guardarCredenciales(@Body() dto: GuardarArcaDto) {
    return this.arcaService.guardarCredenciales(dto);
  }

  /** Resumen de configuración sin exponer cert ni clave */
  @Get('resumen/:sucursalId')
  @RequiereAlgunoPermiso('admin.servicios', 'config.pos')
  getResumen(@Param('sucursalId') sucursalId: string) {
    return this.arcaService.getResumen(sucursalId);
  }

  /** Prueba la conexión con AFIP — renueva el ticket de acceso */
  @Post('test')
  @RequiereAlgunoPermiso('admin.servicios')
  testConexion(@Body() dto: TestArcaDto) {
    return this.arcaService.testConexion(dto.sucursalId);
  }

  /** Cambia entre ambiente testing y producción */
  @Patch('ambiente')
  @RequiereAlgunoPermiso('admin.servicios')
  cambiarAmbiente(@Body() dto: CambiarAmbienteArcaDto) {
    return this.arcaService.cambiarAmbiente(dto);
  }

  /** Consulta el último número autorizado en AFIP para un tipo de comprobante */
  @Get('ultimo-numero/:sucursalId')
  @RequiereAlgunoPermiso('admin.servicios', 'config.pos', 'ventas.ver')
  ultimoNumero(
    @Param('sucursalId') sucursalId: string,
    @Query('tipo') tipo: TipoComprobante,
  ) {
    return this.arcaService.ultimoNumeroAutorizado(sucursalId, tipo);
  }
}
