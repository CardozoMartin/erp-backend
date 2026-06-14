import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

// Formato almacenado: iv_hex:authTag_hex:datos_hex
// Al descifrar detecta automáticamente si los segmentos están en base64 (registros viejos)
// para mantener compatibilidad con datos ya guardados antes de la unificación.

@Injectable()
export class CifradoService {
  private readonly algoritmo = 'aes-256-gcm';
  private readonly clave: Buffer;

  constructor(rawKey: string) {
    // Deriva 32 bytes desde el secreto usando SHA-256
    this.clave = crypto.createHash('sha256').update(rawKey, 'utf8').digest();
  }

  cifrar(texto: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algoritmo, this.clave, iv);
    const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString('hex'), authTag.toString('hex'), cifrado.toString('hex')].join(':');
  }

  descifrar(almacenado: string): string {
    const partes = almacenado.split(':');
    if (partes.length !== 3) {
      throw new Error('Formato de valor cifrado inválido');
    }
    const [seg1, seg2, seg3] = partes;

    // Detecta base64 legacy (registros cifrados antes de la unificación)
    const esBase64 = (s: string) => /^[A-Za-z0-9+/]+=*$/.test(s) && !(/^[0-9a-f]+$/i.test(s));
    const iv      = Buffer.from(seg1, esBase64(seg1) ? 'base64' : 'hex');
    const authTag = Buffer.from(seg2, esBase64(seg2) ? 'base64' : 'hex');
    const cifrado = Buffer.from(seg3, esBase64(seg3) ? 'base64' : 'hex');

    const decipher = crypto.createDecipheriv(this.algoritmo, this.clave, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString('utf8');
  }
}
