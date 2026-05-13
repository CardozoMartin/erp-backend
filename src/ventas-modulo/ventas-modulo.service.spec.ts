import { Test, TestingModule } from '@nestjs/testing';
import { VentasModuloService } from './ventas-modulo.service';

describe('VentasModuloService', () => {
  let service: VentasModuloService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VentasModuloService],
    }).compile();

    service = module.get<VentasModuloService>(VentasModuloService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
