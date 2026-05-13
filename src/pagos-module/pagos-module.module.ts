import { Module } from '@nestjs/common';
import { PagosModuleService } from './pagos-module.service';
import { PagosModuleController } from './pagos-module.controller';

@Module({
  controllers: [PagosModuleController],
  providers: [PagosModuleService],
})
export class PagosModuleModule {}
