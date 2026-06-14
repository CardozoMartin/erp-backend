import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CifradoService } from './cifrado.service';

export const MP_CIFRADO    = 'MP_CIFRADO';
export const EMAIL_CIFRADO = 'EMAIL_CIFRADO';

// 1.- Provee dos instancias de CifradoService, una por cada dominio de cifrado
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
      useFactory: (config: ConfigService) => {
        const key =
          config.get<string>('CONFIG_ENCRYPTION_KEY') ??
          config.get<string>('EMAIL_ENCRYPTION_KEY') ??
          config.getOrThrow<string>('JWT_SECRET');
        return new CifradoService(key);
      },
    },
  ],
  exports: [MP_CIFRADO, EMAIL_CIFRADO],
})
export class SharedModule {}
