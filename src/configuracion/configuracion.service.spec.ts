import { Test, TestingModule } from '@nestjs/testing';
import { ConfiguracionService } from './configuracion.service';

describe('ConfiguracionService', () => {
  let service: ConfiguracionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfiguracionService],
    }).useMocker(() => ({})).compile();

    service = module.get<ConfiguracionService>(ConfiguracionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
