import { Test, TestingModule } from '@nestjs/testing';
import { ProductoPreciosController } from './producto_precios.controller';
import { ProductoPreciosService } from './producto_precios.service';

describe('ProductoPreciosController', () => {
  let controller: ProductoPreciosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductoPreciosController],
      providers: [ProductoPreciosService],
    }).compile();

    controller = module.get<ProductoPreciosController>(ProductoPreciosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
