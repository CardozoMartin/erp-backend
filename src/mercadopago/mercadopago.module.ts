import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MercadopagoService } from './mercadopago.service';
import { MercadopagoController } from './mercadopago.controller';
import { MpConfig } from './entities/mp-config.entity';
import { MpCifradoService } from './mp-cifrado.service';
import { MpWebhookController } from './mp-webhook.controller';
import { CajaModule } from 'src/caja/caja.module';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([MpConfig]), CajaModule],
  controllers: [MercadopagoController, MpWebhookController],
  providers: [MercadopagoService, MpCifradoService],
  exports: [MercadopagoService],
})
export class MercadopagoModule {}
