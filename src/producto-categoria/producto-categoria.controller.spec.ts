import { Test, TestingModule } from '@nestjs/testing';
import { ProductoCategoriaController } from './producto-categoria.controller';
import { ProductoCategoriaService } from './producto-categoria.service';

describe('ProductoCategoriaController', () => {
  let controller: ProductoCategoriaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductoCategoriaController],
      providers: [ProductoCategoriaService],
    }).compile();

    controller = module.get<ProductoCategoriaController>(ProductoCategoriaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
