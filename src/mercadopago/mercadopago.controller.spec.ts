import { Test, TestingModule } from '@nestjs/testing';
import { MercadopagoController } from './mercadopago.controller';
import { MercadopagoService } from './mercadopago.service';

describe('MercadopagoController', () => {
  let controller: MercadopagoController;
  let service: {
    guardarCredenciales: jest.Mock;
    testConexion: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      guardarCredenciales: jest.fn(),
      testConexion: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MercadopagoController],
      providers: [{ provide: MercadopagoService, useValue: service }],
    }).compile();

    controller = module.get<MercadopagoController>(MercadopagoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delega guardar credenciales al service', async () => {
    const dto = {
      sucursalId: 'sucursal-1',
      accessToken: 'APP_USR-token',
      mpUserId: '123456789',
      mpPosId: 'ABC123',
      mpPosNombre: 'Caja 1 - Sucursal Centro',
    };
    service.guardarCredenciales.mockResolvedValue({
      ok: true,
      id: 'mp-config-id',
    });

    await expect(controller.guardar(dto)).resolves.toEqual({
      ok: true,
      id: 'mp-config-id',
    });
    expect(service.guardarCredenciales).toHaveBeenCalledWith(dto);
  });

  it('delega test de conexion al service', async () => {
    service.testConexion.mockResolvedValue({
      ok: true,
      estado: 'activo',
      mpUser: 'nombrecomercio',
      posNombre: 'Caja 1',
    });

    await expect(controller.test('sucursal-1')).resolves.toEqual({
      ok: true,
      estado: 'activo',
      mpUser: 'nombrecomercio',
      posNombre: 'Caja 1',
    });
    expect(service.testConexion).toHaveBeenCalledWith('sucursal-1');
  });
});
