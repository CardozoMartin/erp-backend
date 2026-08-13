import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CifradoService } from './cifrado.service';

export const MP_CIFRADO     = 'MP_CIFRADO';
export const EMAIL_CIFRADO  = 'EMAIL_CIFRADO';
export const ARCA_CIFRADO   = 'ARCA_CIFRADO';
export const BACKUP_CIFRADO = 'BACKUP_CIFRADO';

@Module({
  providers: [
    {
      provide: MP_CIFRADO,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new CifradoService(config.getOrThrow('MP_ENCRYPT_KEY')),
    },
    {
      provide: EMAIL_CIFRADO,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new CifradoService(config.getOrThrow('MASTER_ENCRYPT_KEY')),
    },
    {
      provide: ARCA_CIFRADO,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Sin clave propia caemos a la master: devolver null hacía que el fallo
        // apareciera recién al guardar credenciales, como un TypeError opaco.
        const key =
          config.get<string>('ARCA_ENCRYPT_KEY') ??
          config.getOrThrow<string>('MASTER_ENCRYPT_KEY');
        return new CifradoService(key);
      },
    },
    {
      provide: BACKUP_CIFRADO,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new CifradoService(config.getOrThrow('MASTER_ENCRYPT_KEY')),
    },
  ],
  exports: [MP_CIFRADO, EMAIL_CIFRADO, ARCA_CIFRADO, BACKUP_CIFRADO],
})
export class SharedModule {}
