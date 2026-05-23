import { Test, TestingModule } from '@nestjs/testing';
import { RetirosModuleService } from './retiros-module.service';

describe('RetirosModuleService', () => {
  let service: RetirosModuleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RetirosModuleService],
    }).compile();

    service = module.get<RetirosModuleService>(RetirosModuleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
