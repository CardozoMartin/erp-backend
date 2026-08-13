import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RequiereAlgunoPermiso } from 'src/auth/decorators/requiere-permiso.decorator';
import { BackupService } from './backup.service';
import { GuardarConfigBackupDto } from './dto/backup.dto';

@UseGuards(JwtAuthGuard)
@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('config')
  @RequiereAlgunoPermiso('admin.servicios', 'config.pos')
  getConfig() {
    return this.backupService.getConfig();
  }

  @Post('config')
  @RequiereAlgunoPermiso('admin.servicios', 'config.pos')
  guardarConfig(@Body() dto: GuardarConfigBackupDto, @Request() req) {
    return this.backupService.guardarConfig(dto, req.user?.id);
  }

  @Post('probar')
  @RequiereAlgunoPermiso('admin.servicios', 'config.pos')
  probarConexion() {
    return this.backupService.probarConexion();
  }

  @Post('ejecutar')
  @RequiereAlgunoPermiso('admin.servicios', 'config.pos')
  ejecutar(@Request() req) {
    return this.backupService.ejecutarBackup(req.user?.id, 'MANUAL');
  }

  @Get('historial')
  @RequiereAlgunoPermiso('admin.servicios', 'config.pos')
  historial(@Query('limit') limit?: string) {
    return this.backupService.getHistorial(limit ? Number(limit) : 20);
  }
}
