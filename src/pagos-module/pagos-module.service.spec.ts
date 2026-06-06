import { Test, TestingModule } from '@nestjs/testing';
import { PagosModuleService } from './pagos-module.service';

describe('PagosModuleService', () => {
  let service: PagosModuleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PagosModuleService],
    }).useMocker(() => ({})).compile();

    service = module.get<PagosModuleService>(PagosModuleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
