// mp-cifrado.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class MpCifradoService {
  private readonly algoritmo = 'aes-256-gcm';
  private readonly clave: Buffer;

  constructor(private config: ConfigService) {
    const rawKey = this.config.get<string>('MP_ENCRYPT_KEY');
    if (!rawKey) {
      throw new Error('MP_ENCRYPT_KEY is not set in configuration');
    }

    // Ensure a 32-byte key for aes-256-gcm. Derive with SHA-256 from provided string.
    const hash = crypto.createHash('sha256').update(rawKey, 'utf8').digest();
    this.clave = Buffer.from(hash);
  }

  cifrar(texto: string): string {
    const iv = crypto.randomBytes(12); // 96 bits para GCM
    const cipher = crypto.createCipheriv(this.algoritmo, this.clave, iv);

    const cifrado = Buffer.concat([
      cipher.update(texto, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Guardamos todo junto: iv:authTag:datos — separados por ":"
    return [
      iv.toString('hex'),
      authTag.toString('hex'),
      cifrado.toString('hex'),
    ].join(':');
  }

  descifrar(almacenado: string): string {
    const [ivHex, authTagHex, cifradoHex] = almacenado.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const cifrado = Buffer.from(cifradoHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algoritmo, this.clave, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString(
      'utf8',
    );
  }
}
