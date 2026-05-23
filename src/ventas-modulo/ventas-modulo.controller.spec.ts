import { Test, TestingModule } from '@nestjs/testing';
import { VentasModuloController } from './ventas-modulo.controller';
import { VentasModuloService } from './ventas-modulo.service';

describe('VentasModuloController', () => {
  let controller: VentasModuloController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VentasModuloController],
      providers: [VentasModuloService],
    }).compile();

    controller = module.get<VentasModuloController>(VentasModuloController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
