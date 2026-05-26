import { Test, TestingModule } from '@nestjs/testing';
import { ConfigPosService } from './config-pos.service';

describe('ConfigPosService', () => {
  let service: ConfigPosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigPosService],
    }).compile();

    service = module.get<ConfigPosService>(ConfigPosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
