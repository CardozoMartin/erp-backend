import { Test, TestingModule } from '@nestjs/testing';
import { ProductoCategoriaService } from './producto-categoria.service';

describe('ProductoCategoriaService', () => {
  let service: ProductoCategoriaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductoCategoriaService],
    }).compile();

    service = module.get<ProductoCategoriaService>(ProductoCategoriaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
