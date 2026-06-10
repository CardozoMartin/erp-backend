import { Test, TestingModule } from '@nestjs/testing';
import { MarcaProductosController } from './marca_productos.controller';
import { MarcaProductosService } from './marca_productos.service';

describe('MarcaProductosController', () => {
  let controller: MarcaProductosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarcaProductosController],
      providers: [MarcaProductosService],
    }).useMocker(() => ({})).compile();

    controller = module.get<MarcaProductosController>(MarcaProductosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
