import { Test, TestingModule } from '@nestjs/testing';
import { RetirosModuleController } from './retiros-module.controller';
import { RetirosModuleService } from './retiros-module.service';

describe('RetirosModuleController', () => {
  let controller: RetirosModuleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RetirosModuleController],
      providers: [RetirosModuleService],
    }).compile();

    controller = module.get<RetirosModuleController>(RetirosModuleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
