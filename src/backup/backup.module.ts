import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { BackupConfig } from './entities/backup-config.entity';
import { BackupHistorial } from './entities/backup-historial.entity';
import { SharedModule } from 'src/shared/shared.module';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BackupConfig, BackupHistorial]),
    ScheduleModule.forRoot(),
    SharedModule,
    AuditoriaModule,
  ],
  controllers: [BackupController],
  providers: [BackupService],
})
export class BackupModule {}
