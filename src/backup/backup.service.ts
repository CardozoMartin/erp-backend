import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { google } from 'googleapis';
import { spawn } from 'child_process';
import { createGzip } from 'zlib';
import { pipeline } from 'stream';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CifradoService } from 'src/shared/cifrado.service';
import { BACKUP_CIFRADO } from 'src/shared/shared.module';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { BackupConfig, FrecuenciaBackup } from './entities/backup-config.entity';
import { BackupHistorial, EstadoBackup } from './entities/backup-historial.entity';
import { GuardarConfigBackupDto } from './dto/backup.dto';

const pipelineAsync = promisify(pipeline);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    @InjectRepository(BackupConfig)
    private readonly configRepo: Repository<BackupConfig>,
    @InjectRepository(BackupHistorial)
    private readonly historialRepo: Repository<BackupHistorial>,
    @Inject(BACKUP_CIFRADO)
    private readonly cifrado: CifradoService,
    private readonly configService: ConfigService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  // ─── Configuración ────────────────────────────────────────────────────────

  async getConfig(): Promise<Omit<BackupConfig, 'client_id_enc' | 'client_secret_enc' | 'refresh_token_enc'> & {
    tiene_credenciales: boolean;
  }> {
    const config = await this.obtenerOCrearConfig();
    const { client_id_enc, client_secret_enc, refresh_token_enc, ...rest } = config;
    return {
      ...rest,
      tiene_credenciales: !!(client_id_enc && client_secret_enc && refresh_token_enc),
    };
  }

  async guardarConfig(dto: GuardarConfigBackupDto, empleadoId?: string | null): Promise<void> {
    const config = await this.obtenerOCrearConfig();

    if (dto.client_id !== undefined)
      config.client_id_enc = dto.client_id ? this.cifrado.cifrar(dto.client_id) : null;
    if (dto.client_secret !== undefined)
      config.client_secret_enc = dto.client_secret ? this.cifrado.cifrar(dto.client_secret) : null;
    if (dto.refresh_token !== undefined)
      config.refresh_token_enc = dto.refresh_token ? this.cifrado.cifrar(dto.refresh_token) : null;
    if (dto.carpeta_drive !== undefined) config.carpeta_drive = dto.carpeta_drive || null;
    if (dto.frecuencia !== undefined) config.frecuencia = dto.frecuencia as FrecuenciaBackup;
    if (dto.hora_backup !== undefined) config.hora_backup = dto.hora_backup;
    if (dto.retener_ultimos !== undefined) config.retener_ultimos = dto.retener_ultimos;
    if (dto.activo !== undefined) config.activo = dto.activo;

    await this.configRepo.save(config);
    await this.auditoriaService.registrar({
      modulo: 'backup',
      accion: 'GUARDAR_CONFIG_BACKUP',
      empleado_id: empleadoId ?? null,
      descripcion: 'Configuracion de backup de Google Drive actualizada',
    });
  }

  // ─── Verificar conexión con Drive ─────────────────────────────────────────

  async probarConexion(): Promise<{ ok: boolean; email?: string; mensaje: string }> {
    const drive = await this.buildDriveClient();
    try {
      const res = await drive.about.get({ fields: 'user' });
      return {
        ok: true,
        email: res.data.user?.emailAddress ?? undefined,
        mensaje: `Conectado como ${res.data.user?.displayName ?? res.data.user?.emailAddress}`,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error de conexión con Google Drive';
      return { ok: false, mensaje: msg };
    }
  }

  // ─── Ejecutar backup manual ───────────────────────────────────────────────

  async ejecutarBackup(empleadoId?: string | null, origen: 'MANUAL' | 'AUTOMATICO' = 'MANUAL'): Promise<BackupHistorial> {
    const registro = this.historialRepo.create({ estado: EstadoBackup.EN_PROCESO, origen });
    await this.historialRepo.save(registro);

    // Ejecuta en background sin bloquear la respuesta HTTP
    this.runBackup(registro, empleadoId).catch(async (err) => {
      registro.estado = EstadoBackup.FALLIDO;
      registro.error = err.message ?? String(err);
      await this.historialRepo.save(registro);
    });

    return registro;
  }

  // ─── Historial ────────────────────────────────────────────────────────────

  async getHistorial(limit = 20): Promise<BackupHistorial[]> {
    return this.historialRepo.find({
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  // ─── Scheduler automático ─────────────────────────────────────────────────

  // Corre cada hora en punto y verifica si corresponde ejecutar según la config
  @Cron('0 * * * *')
  async scheduledBackup() {
    const config = await this.obtenerOCrearConfig();
    if (!config.activo || config.frecuencia === FrecuenciaBackup.MANUAL) return;
    if (!config.client_id_enc || !config.refresh_token_enc) return;

    const horaActual = new Date().getHours();
    if (horaActual !== config.hora_backup) return;

    if (config.frecuencia === FrecuenciaBackup.SEMANAL) {
      // Solo los domingos
      if (new Date().getDay() !== 0) return;
    }

    this.logger.log(`Ejecutando backup automático (${config.frecuencia})`);
    await this.ejecutarBackup(null, 'AUTOMATICO');
  }

  // ─── Lógica interna ───────────────────────────────────────────────────────

  private async runBackup(registro: BackupHistorial, empleadoId?: string | null) {
    const config = await this.obtenerOCrearConfig();
    if (!config.client_id_enc || !config.client_secret_enc || !config.refresh_token_enc) {
      throw new BadRequestException('Google Drive no está configurado. Guardá las credenciales primero.');
    }

    const tmpDir = os.tmpdir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dbName = this.configService.getOrThrow('DB_NAME');
    const nombreArchivo = `backup_${dbName}_${timestamp}.sql.gz`;
    const rutaTmp = path.join(tmpDir, nombreArchivo).replace(/\\/g, '/');

    registro.nombre_archivo = nombreArchivo;
    await this.historialRepo.save(registro);

    // 1.- Generar el dump y comprimir en el mismo pipeline
    await this.generarDump(rutaTmp);

    // 2.- Subir a Google Drive
    this.logger.log(`Buscando gz en: ${rutaTmp}, existe: ${fs.existsSync(rutaTmp)}`);
    const tamano = fs.statSync(rutaTmp).size;
    const drive = await this.buildDriveClient(config);
    this.logger.log(`Subiendo a Drive: ${nombreArchivo}`);
    let fileId: string, link: string;
    try {
      ({ fileId, link } = await this.subirADrive(drive, rutaTmp, nombreArchivo, config.carpeta_drive));
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: unknown }; errors?: unknown };
      this.logger.error(`Error subiendo a Drive: ${err.message} | ${JSON.stringify(err.response?.data ?? err.errors ?? '')}`);
      throw e;
    }
    this.logger.log(`Subido OK: ${fileId}`);

    // 3.- Limpiar el archivo temporal
    fs.unlinkSync(rutaTmp);

    // 4.- Actualizar registro como exitoso
    registro.estado = EstadoBackup.EXITOSO;
    registro.drive_file_id = fileId;
    registro.drive_link = link;
    registro.tamano_bytes = tamano;
    registro.error = null;
    await this.historialRepo.save(registro);

    // 5.- Limpiar backups viejos en Drive
    await this.limpiarBackupsViejos(drive, config).catch(() => undefined);

    await this.auditoriaService.registrar({
      modulo: 'backup',
      accion: 'BACKUP_EXITOSO',
      empleado_id: empleadoId ?? null,
      descripcion: `Backup ${nombreArchivo} subido a Google Drive (${this.formatBytes(tamano)})`,
      despues: { nombre_archivo: nombreArchivo, tamano_bytes: tamano, drive_link: link },
    });
  }

  private generarDump(rutaSalida: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const host   = this.configService.getOrThrow('DB_HOST');
      const port   = this.configService.get('DB_PORT') ?? '3306';
      const user   = this.configService.getOrThrow('DB_USER');
      const pass   = this.configService.getOrThrow('DB_PASS');
      const dbName = this.configService.getOrThrow('DB_NAME');

      const tmpBase = os.tmpdir();
      const rutaSqlNorm = path.join(tmpBase, path.basename(rutaSalida).replace(/\.gz$/, ''));

      const args = [
        `-h`, host,
        `-P`, String(port),
        `-u`, user,
        `--single-transaction`,
        `--routines`,
        `--triggers`,
        `--result-file=${rutaSqlNorm}`,
        dbName,
      ];

      const stderrLines: string[] = [];
      // Pasar la contraseña por variable de entorno para evitar que aparezca en logs o en la lista de procesos
      const child = spawn('mysqldump', args, { env: { ...process.env, MYSQL_PWD: pass } });
      child.on('error', reject);
      child.stderr?.on('data', (d: string) => { stderrLines.push(String(d)); this.logger.warn(`mysqldump stderr: ${d}`); });
      child.on('close', (code) => {
        if (!fs.existsSync(rutaSqlNorm) || fs.statSync(rutaSqlNorm).size === 0) {
          return reject(new Error(`mysqldump no generó el archivo. stderr: ${stderrLines.join('')}`));
        }
        const rutaGz = rutaSqlNorm + '.gz';
        const src = fs.createReadStream(rutaSqlNorm);
        const gzip = createGzip();
        const out = fs.createWriteStream(rutaGz);
        pipelineAsync(src, gzip, out)
          .then(() => { fs.unlinkSync(rutaSqlNorm); resolve(); })
          .catch(reject);
      });
    });
  }

  private async subirADrive(
    drive: ReturnType<typeof google.drive>,
    rutaArchivo: string,
    nombre: string,
    carpeta: string | null,
  ): Promise<{ fileId: string; link: string }> {
    const fileStream = fs.createReadStream(rutaArchivo);
    const metadata: Record<string, any> = { name: nombre };
    if (carpeta) metadata.parents = [carpeta];

    const res = await drive.files.create({
      requestBody: metadata,
      media: { mimeType: 'application/gzip', body: fileStream },
      fields: 'id,webViewLink',
    });

    return {
      fileId: res.data.id!,
      link: res.data.webViewLink ?? '',
    };
  }

  private async limpiarBackupsViejos(
    drive: ReturnType<typeof google.drive>,
    config: BackupConfig,
  ): Promise<void> {
    const dbName = this.configService.getOrThrow('DB_NAME');
    const query = `name contains 'backup_${dbName}_' and trashed = false`;
    const res = await drive.files.list({
      q: query,
      fields: 'files(id,name,createdTime)',
      orderBy: 'createdTime desc',
    });

    const archivos = res.data.files ?? [];
    const aEliminar = archivos.slice(config.retener_ultimos);
    for (const archivo of aEliminar) {
      if (archivo.id) {
        await drive.files.delete({ fileId: archivo.id }).catch(() => undefined);
        this.logger.log(`Backup antiguo eliminado de Drive: ${archivo.name}`);
      }
    }
  }

  private async buildDriveClient(config?: BackupConfig) {
    const cfg = config ?? await this.obtenerOCrearConfig();
    if (!cfg.client_id_enc || !cfg.client_secret_enc || !cfg.refresh_token_enc) {
      throw new BadRequestException('Credenciales de Google Drive no configuradas');
    }

    const auth = new google.auth.OAuth2(
      this.cifrado.descifrar(cfg.client_id_enc),
      this.cifrado.descifrar(cfg.client_secret_enc),
    );
    auth.setCredentials({ refresh_token: this.cifrado.descifrar(cfg.refresh_token_enc) });
    return google.drive({ version: 'v3', auth });
  }

  private async obtenerOCrearConfig(): Promise<BackupConfig> {
    const existe = await this.configRepo.findOne({ where: {} });
    if (existe) return existe;
    return this.configRepo.save(this.configRepo.create());
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
