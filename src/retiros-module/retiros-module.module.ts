import { Module } from '@nestjs/common';
import { RetirosModuleService } from './retiros-module.service';
import { RetirosModuleController } from './retiros-module.controller';

@Module({
  controllers: [RetirosModuleController],
  providers: [RetirosModuleService],
})
export class RetirosModuleModule {}
