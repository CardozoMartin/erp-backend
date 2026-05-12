import { Test, TestingModule } from '@nestjs/testing';
import { StocksProductsService } from './stocks-products.service';

describe('StocksProductsService', () => {
  let service: StocksProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StocksProductsService],
    }).compile();

    service = module.get<StocksProductsService>(StocksProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
