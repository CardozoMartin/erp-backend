import { Test, TestingModule } from '@nestjs/testing';
import { ConfigPosController } from './config-pos.controller';
import { ConfigPosService } from './config-pos.service';

describe('ConfigPosController', () => {
  let controller: ConfigPosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigPosController],
      providers: [ConfigPosService],
    }).compile();

    controller = module.get<ConfigPosController>(ConfigPosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
