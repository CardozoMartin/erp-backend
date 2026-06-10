import { Test, TestingModule } from '@nestjs/testing';
import { ListaPrecioController } from './lista-precio.controller';
import { ListaPrecioService } from './lista-precio.service';

describe('ListaPrecioController', () => {
  let controller: ListaPrecioController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListaPrecioController],
      providers: [ListaPrecioService],
    }).useMocker(() => ({})).compile();

    controller = module.get<ListaPrecioController>(ListaPrecioController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
