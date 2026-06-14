// mp-cifrado.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { CifradoService } from 'src/shared/cifrado.service';
import { MP_CIFRADO } from 'src/shared/shared.module';

// 1.- Wrapper que expone cifrar/descifrar usando la clave MP_ENCRYPT_KEY
@Injectable()
export class MpCifradoService {
  constructor(@Inject(MP_CIFRADO) private readonly cifrado: CifradoService) {}

  cifrar(texto: string): string {
    return this.cifrado.cifrar(texto);
  }

  descifrar(almacenado: string): string {
    return this.cifrado.descifrar(almacenado);
  }
}
