import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';
import { Socket, connect as netConnect } from 'net';
import { TLSSocket, connect as tlsConnect } from 'tls';
import { Repository } from 'typeorm';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import {
  ProbarConfiguracionEmailDto,
  UpsertConfiguracionEmailDto,
} from './dto/configuracion-email.dto';
import {
  ConfiguracionEmailSucursal,
  ProveedorEmail,
  SeguridadEmail,
} from './entities/configuracion-email.entity';

type SafeEmailConfig = Omit<ConfiguracionEmailSucursal, 'password_encriptado'> & {
  password_configurado: boolean;
};

type SmtpOptions = {
  host: string;
  port: number;
  seguridad: SeguridadEmail;
  user: string;
  password: string;
  from: string;
  fromName?: string | null;
  replyTo?: string | null;
  to: string;
  bcc?: string | null;
  subject: string;
  text: string;
  attachments?: EmailAttachment[];
};

export type EmailAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

export type EnviarCorreoSucursalOptions = {
  to: string;
  subject: string;
  text: string;
  bcc?: string | null;
  attachments?: EmailAttachment[];
};

@Injectable()
export class ConfiguracionEmailService {
  constructor(
    @InjectRepository(ConfiguracionEmailSucursal)
    private readonly emailRepo: Repository<ConfiguracionEmailSucursal>,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async findBySucursal(sucursalId: string): Promise<SafeEmailConfig> {
    const config = await this.emailRepo.findOne({ where: { sucursal_id: sucursalId } });
    if (!config) {
      throw new NotFoundException(`No hay configuracion de email para la sucursal ${sucursalId}`);
    }
    return this.toSafeConfig(config);
  }

  async upsert(
    sucursalId: string,
    dto: UpsertConfiguracionEmailDto,
    empleadoActorId?: string | null,
  ): Promise<SafeEmailConfig> {
    const current = await this.emailRepo.findOne({ where: { sucursal_id: sucursalId } });
    const normalized = this.normalizeDto({ ...dto, sucursal_id: sucursalId });

    if (!current && !normalized.password) {
      throw new BadRequestException('Ingrese una contrasena de aplicacion o clave SMTP');
    }

    const password_encriptado = normalized.password
      ? this.encrypt(normalized.password)
      : current?.password_encriptado;

    const entity = this.emailRepo.create({
      ...(current ?? {}),
      ...normalized,
      activo: false,
      ultimo_test_at: null,
      password_encriptado,
    });
    delete (entity as Partial<UpsertConfiguracionEmailDto>).password;

    const saved = await this.emailRepo.save(entity);
    await this.auditoriaService.registrar({
      modulo: 'configuracion',
      accion: current ? 'ACTUALIZAR_CONFIGURACION_EMAIL' : 'CREAR_CONFIGURACION_EMAIL',
      entidad: 'configuracion_email',
      entidad_id: saved.sucursal_id,
      empleado_id: empleadoActorId ?? null,
      sucursal_id: saved.sucursal_id,
      descripcion: `Configuracion Email ${current ? 'actualizada' : 'creada'} para sucursal ${saved.sucursal_id}`,
      antes: current ? this.snapshot(current) : null,
      despues: this.snapshot(saved),
      metadata: { password_actualizado: !!normalized.password },
    });
    return this.toSafeConfig(saved);
  }

  async probar(
    sucursalId: string,
    dto: ProbarConfiguracionEmailDto,
    empleadoActorId?: string | null,
  ) {
    const config = await this.emailRepo.findOne({ where: { sucursal_id: sucursalId } });
    if (!config) {
      throw new NotFoundException(`No hay configuracion de email para la sucursal ${sucursalId}`);
    }
    await this.sendSmtp({
      host: config.smtp_host,
      port: config.smtp_port,
      seguridad: config.seguridad,
      user: config.usuario,
      password: this.decrypt(config.password_encriptado),
      from: config.email_remitente,
      fromName: config.nombre_remitente,
      replyTo: config.email_respuesta,
      to: dto.destino,
      bcc: config.copia_oculta_admin ? config.email_copia_admin : null,
      subject: 'Prueba de correo - ERP POS',
      text:
        'La configuracion de email esta funcionando correctamente.\n\n' +
        'Este mensaje fue enviado desde el modulo Configuracion Email del ERP.',
    });

    config.activo = true;
    config.ultimo_test_at = new Date();
    await this.emailRepo.save(config);
    await this.auditoriaService.registrar({
      modulo: 'configuracion',
      accion: 'PROBAR_CONFIGURACION_EMAIL',
      entidad: 'configuracion_email',
      entidad_id: sucursalId,
      empleado_id: empleadoActorId ?? null,
      sucursal_id: sucursalId,
      descripcion: `Correo de prueba enviado a ${dto.destino}. Configuracion email activada.`,
    });

    return {
      ok: true,
      message: `Correo de prueba enviado a ${dto.destino}. El sistema ya esta configurado para enviar emails.`,
    };
  }

  async enviarCorreoSucursal(
    sucursalId: string,
    options: EnviarCorreoSucursalOptions,
  ) {
    const config = await this.emailRepo.findOne({ where: { sucursal_id: sucursalId } });
    if (!config) {
      throw new NotFoundException(`No hay configuracion de email para la sucursal ${sucursalId}`);
    }
    if (!config.activo) {
      throw new BadRequestException(
        'La configuracion de email todavia no fue verificada. Envie un correo de prueba desde Configuracion Email.',
      );
    }
    await this.sendSmtp({
      host: config.smtp_host,
      port: config.smtp_port,
      seguridad: config.seguridad,
      user: config.usuario,
      password: this.decrypt(config.password_encriptado),
      from: config.email_remitente,
      fromName: config.nombre_remitente,
      replyTo: config.email_respuesta,
      to: options.to,
      bcc: options.bcc ?? (config.copia_oculta_admin ? config.email_copia_admin : null),
      subject: options.subject,
      text: options.text,
      attachments: options.attachments,
    });
    return { ok: true };
  }

  private normalizeDto(dto: UpsertConfiguracionEmailDto) {
    const proveedor = dto.proveedor ?? ProveedorEmail.GMAIL;
    const isGmail = proveedor === ProveedorEmail.GMAIL;
    return {
      sucursal_id: dto.sucursal_id,
      activo: false,
      proveedor,
      email_remitente: dto.email_remitente.trim().toLowerCase(),
      nombre_remitente: this.textOrNull(dto.nombre_remitente),
      usuario: dto.usuario.trim(),
      smtp_host: (isGmail ? 'smtp.gmail.com' : dto.smtp_host || '').trim(),
      smtp_port: Number(isGmail ? 465 : dto.smtp_port || 465),
      seguridad: isGmail ? SeguridadEmail.SSL : dto.seguridad ?? SeguridadEmail.SSL,
      password: dto.password?.trim() || undefined,
      email_respuesta: this.textOrNull(dto.email_respuesta)?.toLowerCase() ?? null,
      enviar_facturas_email: dto.enviar_facturas_email ?? true,
      enviar_facturas_automaticamente: dto.enviar_facturas_automaticamente ?? false,
      adjuntar_pdf: dto.adjuntar_pdf ?? true,
      copia_oculta_admin: dto.copia_oculta_admin ?? false,
      email_copia_admin: this.textOrNull(dto.email_copia_admin)?.toLowerCase() ?? null,
    };
  }

  private textOrNull(value?: string | null) {
    return value?.trim() || null;
  }

  private toSafeConfig(config: ConfiguracionEmailSucursal): SafeEmailConfig {
    const { password_encriptado, ...safe } = config;
    void password_encriptado;
    return { ...safe, password_configurado: !!config.password_encriptado };
  }

  private snapshot(config: ConfiguracionEmailSucursal) {
    const safe = this.toSafeConfig(config);
    return { ...safe };
  }

  private getEncryptionKey() {
    const secret =
      process.env.CONFIG_ENCRYPTION_KEY ||
      process.env.EMAIL_ENCRYPTION_KEY ||
      process.env.JWT_SECRET ||
      'erp-local-config-key';
    return createHash('sha256').update(secret).digest();
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  private decrypt(value: string) {
    const [ivText, tagText, encryptedText] = value.split(':');
    if (!ivText || !tagText || !encryptedText) {
      throw new BadRequestException('La clave de email guardada no tiene un formato valido');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getEncryptionKey(),
      Buffer.from(ivText, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagText, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private async sendSmtp(options: SmtpOptions) {
    let socket: Socket | TLSSocket =
      options.seguridad === SeguridadEmail.SSL
        ? tlsConnect({ host: options.host, port: options.port, servername: options.host })
        : netConnect({ host: options.host, port: options.port });

    socket.setTimeout(20000);
    const read = () => this.readSmtpResponse(socket);
    const write = async (command: string, expected: number[]) => {
      socket.write(`${command}\r\n`);
      const response = await read();
      if (!expected.includes(response.code)) {
        throw new BadRequestException(`SMTP rechazo ${command.split(' ')[0]}: ${response.message}`);
      }
      return response;
    };

    try {
      const greeting = await read();
      if (greeting.code !== 220) {
        throw new BadRequestException(`SMTP no disponible: ${greeting.message}`);
      }

      await write(`EHLO ${this.localHostname()}`, [250]);
      if (options.seguridad === SeguridadEmail.STARTTLS) {
        await write('STARTTLS', [220]);
        socket = tlsConnect({ socket, servername: options.host });
        await write(`EHLO ${this.localHostname()}`, [250]);
      }

      await write('AUTH LOGIN', [334]);
      await write(Buffer.from(options.user).toString('base64'), [334]);
      await write(Buffer.from(options.password).toString('base64'), [235]);
      await write(`MAIL FROM:<${options.from}>`, [250]);
      await write(`RCPT TO:<${options.to}>`, [250, 251]);
      if (options.bcc) {
        await write(`RCPT TO:<${options.bcc}>`, [250, 251]);
      }
      await write('DATA', [354]);
      socket.write(`${this.buildMessage(options)}\r\n.\r\n`);
      const sent = await read();
      if (sent.code !== 250) {
        throw new BadRequestException(`SMTP no pudo enviar el mensaje: ${sent.message}`);
      }
      await write('QUIT', [221]);
    } finally {
      socket.end();
    }
  }

  private readSmtpResponse(socket: Socket | TLSSocket): Promise<{ code: number; message: string }> {
    return new Promise((resolve, reject) => {
      let buffer = '';
      const cleanup = () => {
        socket.off('data', onData);
        socket.off('error', onError);
        socket.off('timeout', onTimeout);
      };
      const onError = (error: Error) => {
        cleanup();
        reject(new BadRequestException(`Error SMTP: ${error.message}`));
      };
      const onTimeout = () => {
        cleanup();
        reject(new BadRequestException('Tiempo de espera agotado conectando SMTP'));
      };
      const onData = (data: Buffer) => {
        buffer += data.toString('utf8');
        const lines = buffer.split(/\r?\n/).filter(Boolean);
        const last = lines[lines.length - 1];
        if (/^\d{3} /.test(last)) {
          cleanup();
          resolve({ code: Number(last.slice(0, 3)), message: lines.join(' ') });
        }
      };
      socket.on('data', onData);
      socket.on('error', onError);
      socket.on('timeout', onTimeout);
    });
  }

  private buildMessage(options: SmtpOptions) {
    if (options.attachments?.length) {
      const boundary = `erp_${randomBytes(12).toString('hex')}`;
      const headers = [
        `From: ${this.formatAddress(options.from, options.fromName)}`,
        `To: <${options.to}>`,
        options.replyTo ? `Reply-To: <${options.replyTo}>` : null,
        `Subject: ${this.encodeHeader(options.subject)}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ].filter(Boolean);
      const parts = [
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        options.text,
        ...options.attachments.flatMap((attachment) => [
          `--${boundary}`,
          `Content-Type: ${attachment.contentType}; name="${this.escapeMimeParam(attachment.filename)}"`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${this.escapeMimeParam(attachment.filename)}"`,
          '',
          attachment.content.toString('base64').replace(/.{1,76}/g, '$&\r\n').trim(),
        ]),
        `--${boundary}--`,
      ];
      return `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
    }

    const headers = [
      `From: ${this.formatAddress(options.from, options.fromName)}`,
      `To: <${options.to}>`,
      options.replyTo ? `Reply-To: <${options.replyTo}>` : null,
      `Subject: ${this.encodeHeader(options.subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
    ].filter(Boolean);
    return `${headers.join('\r\n')}\r\n\r\n${options.text}`;
  }

  private formatAddress(email: string, name?: string | null) {
    return name ? `${this.encodeHeader(name)} <${email}>` : `<${email}>`;
  }

  private encodeHeader(value: string) {
    return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
  }

  private escapeMimeParam(value: string) {
    return value.replace(/["\r\n]/g, '_');
  }

  private localHostname() {
    return process.env.SMTP_EHLO_HOST || 'localhost';
  }
}
