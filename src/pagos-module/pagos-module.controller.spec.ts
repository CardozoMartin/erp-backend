import { Test, TestingModule } from '@nestjs/testing';
import { PagosModuleController } from './pagos-module.controller';
import { PagosModuleService } from './pagos-module.service';

describe('PagosModuleController', () => {
  let controller: PagosModuleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PagosModuleController],
      providers: [PagosModuleService],
    }).useMocker(() => ({})).compile();

    controller = module.get<PagosModuleController>(PagosModuleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
