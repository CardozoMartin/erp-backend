import { Injectable } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { permisosSeed } from './permisos-seed';
import { CrearPermisoDto } from './dto/create-permiso.dto';

@Injectable()
export class PermisosSeedService {
  constructor(private readonly permisosService: PermisosService) {}

  async seedDefaultPermissions(): Promise<{
    creados: number;
    existentes: number;
    analizados: number;
  }> {
    const { creados, existentes } = await this.permisosService.createMissing(
      permisosSeed,
    );

    return {
      creados: creados.length,
      existentes: existentes.length,
      analizados: permisosSeed.length,
    };
  }

  async seedPermissions(permisos: CrearPermisoDto[]): Promise<{
    creados: number;
    existentes: number;
    analizados: number;
  }> {
    const { creados, existentes } = await this.permisosService.createMissing(
      permisos,
    );

    return {
      creados: creados.length,
      existentes: existentes.length,
      analizados: permisos.length,
    };
  }
}
