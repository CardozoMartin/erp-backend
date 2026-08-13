import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArcaConfig } from './entities/arca-config.entity';
import { ArcaController } from './arca.controller';
import { ArcaService } from './arca.service';
import { ArcaWsaaService } from './arca-wsaa.service';
import { ArcaWsfev1Service } from './arca-wsfev1.service';
import { SharedModule } from 'src/shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ArcaConfig]),
    SharedModule,
  ],
  controllers: [ArcaController],
  providers: [ArcaService, ArcaWsaaService, ArcaWsfev1Service],
  exports: [ArcaService],
})
export class ArcaModule {}
