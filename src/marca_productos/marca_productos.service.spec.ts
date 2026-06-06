import { Test, TestingModule } from '@nestjs/testing';
import { MarcaProductosService } from './marca_productos.service';

describe('MarcaProductosService', () => {
  let service: MarcaProductosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MarcaProductosService],
    }).useMocker(() => ({})).compile();

    service = module.get<MarcaProductosService>(MarcaProductosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
