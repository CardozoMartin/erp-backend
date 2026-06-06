import { Test, TestingModule } from '@nestjs/testing';
import { ListaPrecioService } from './lista-precio.service';

describe('ListaPrecioService', () => {
  let service: ListaPrecioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ListaPrecioService],
    }).useMocker(() => ({})).compile();

    service = module.get<ListaPrecioService>(ListaPrecioService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
