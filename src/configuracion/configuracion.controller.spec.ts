import { Test, TestingModule } from '@nestjs/testing';
import { ConfiguracionController } from './configuracion.controller';
import { ConfiguracionService } from './configuracion.service';

describe('ConfiguracionController', () => {
  let controller: ConfiguracionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfiguracionController],
      providers: [ConfiguracionService],
    }).useMocker(() => ({})).compile();

    controller = module.get<ConfiguracionController>(ConfiguracionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
