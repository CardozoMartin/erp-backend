import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { CifradoService } from 'src/shared/cifrado.service';
import { EMAIL_CIFRADO } from 'src/shared/shared.module';
import { EmailTemplateService } from 'src/email/email-template.service';
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

export type EmailAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

export type EnviarCorreoSucursalOptions = {
  to: string;
  subject: string;
  /** Texto plano — siempre requerido como fallback para clientes sin HTML */
  text: string;
  /** HTML opcional — si se provee se envía como parte alternativa */
  html?: string;
  bcc?: string | null;
  attachments?: EmailAttachment[];
};

@Injectable()
export class ConfiguracionEmailService {
  constructor(
    @InjectRepository(ConfiguracionEmailSucursal)
    private readonly emailRepo: Repository<ConfiguracionEmailSucursal>,
    private readonly auditoriaService: AuditoriaService,
    @Inject(EMAIL_CIFRADO) private readonly cifrado: CifradoService,
    private readonly templates: EmailTemplateService,
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
      ? this.cifrado.cifrar(normalized.password)
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

    // 1.- Renderiza el HTML de prueba con el nombre del negocio
    const html = this.templates.renderizar('prueba', {
      nombreEmpresa: config.nombre_remitente ?? 'ERP',
    });

    const transporter = this.crearTransporter(config);
    await this.enviarConTransporter(transporter, {
      from: this.formatFrom(config.email_remitente, config.nombre_remitente),
      to: dto.destino,
      replyTo: config.email_respuesta ?? undefined,
      bcc: config.copia_oculta_admin && config.email_copia_admin ? config.email_copia_admin : undefined,
      subject: 'Prueba de correo - ERP POS',
      text: 'La configuracion de email esta funcionando correctamente. Este mensaje fue enviado desde el modulo Configuracion Email del ERP.',
      html,
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

    const transporter = this.crearTransporter(config);
    await this.enviarConTransporter(transporter, {
      from: this.formatFrom(config.email_remitente, config.nombre_remitente),
      to: options.to,
      replyTo: config.email_respuesta ?? undefined,
      bcc: options.bcc ?? (config.copia_oculta_admin ? config.email_copia_admin ?? undefined : undefined),
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });

    return { ok: true };
  }

  /**
   * Si MASTER_ENCRYPT_KEY cambia, la password guardada queda indescifrable y AES-GCM
   * falla al validar el authTag. Sin este catch el error sube como 500 opaco y parece
   * un problema de SMTP, cuando en realidad basta con volver a guardar la password.
   */
  private descifrarPassword(config: ConfiguracionEmailSucursal): string {
    try {
      return this.cifrado.descifrar(config.password_encriptado);
    } catch {
      throw new BadRequestException(
        'La contraseña de email guardada no se puede descifrar (la clave de cifrado del servidor cambió). ' +
          'Volvé a cargarla en Configuracion → Email para regenerarla.',
      );
    }
  }

  // 2.- Crea el Transporter de Nodemailer según la seguridad configurada
  private crearTransporter(config: ConfiguracionEmailSucursal): Transporter {
    const password = this.descifrarPassword(config);

    const secure = config.seguridad === SeguridadEmail.SSL;
    const requireTLS = config.seguridad === SeguridadEmail.STARTTLS;

    return nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure,
      requireTLS,
      auth: { user: config.usuario, pass: password },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 20000,
      greetingTimeout: 15000,
    });
  }

  // 3.- Envía el mensaje y mapea errores de Nodemailer a BadRequestException
  private async enviarConTransporter(
    transporter: Transporter,
    mensaje: nodemailer.SendMailOptions,
  ): Promise<void> {
    try {
      await transporter.sendMail(mensaje);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Error al enviar el email: ${msg}`);
    }
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

  private formatFrom(email: string, nombre?: string | null): string {
    return nombre ? `"${nombre}" <${email}>` : email;
  }

  private toSafeConfig(config: ConfiguracionEmailSucursal): SafeEmailConfig {
    const { password_encriptado, ...safe } = config;
    void password_encriptado;
    return { ...safe, password_configurado: !!config.password_encriptado };
  }

  private snapshot(config: ConfiguracionEmailSucursal) {
    return { ...this.toSafeConfig(config) };
  }
}
