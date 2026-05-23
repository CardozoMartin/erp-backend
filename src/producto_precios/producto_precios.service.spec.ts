import { Test, TestingModule } from '@nestjs/testing';
import { ProductoPreciosService } from './producto_precios.service';

describe('ProductoPreciosService', () => {
  let service: ProductoPreciosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductoPreciosService],
    }).compile();

    service = module.get<ProductoPreciosService>(ProductoPreciosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
