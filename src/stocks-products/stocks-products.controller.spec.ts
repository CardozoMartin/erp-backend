import { Test, TestingModule } from '@nestjs/testing';
import { StocksProductsController } from './stocks-products.controller';
import { StocksProductsService } from './stocks-products.service';

describe('StocksProductsController', () => {
  let controller: StocksProductsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StocksProductsController],
      providers: [StocksProductsService],
    }).compile();

    controller = module.get<StocksProductsController>(StocksProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
