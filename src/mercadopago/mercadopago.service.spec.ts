import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import axios from 'axios';
import { MercadopagoService } from './mercadopago.service';
import { MpConfig } from './entities/mp-config.entity';
import { MpCifradoService } from './mp-cifrado.service';
import { ConfigService } from '@nestjs/config';

jest.mock('axios');

describe('MercadopagoService', () => {
  let service: MercadopagoService;
  let repo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let cifrado: {
    cifrar: jest.Mock;
    descifrar: jest.Mock;
  };

  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn(() => ({})),
      save: jest.fn(),
    };
    cifrado = {
      cifrar: jest.fn((value: string) => `enc:${value}`),
      descifrar: jest.fn(() => 'APP_USR-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MercadopagoService,
        { provide: getRepositoryToken(MpConfig), useValue: repo },
        { provide: MpCifradoService, useValue: cifrado },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<MercadopagoService>(MercadopagoService);
    mockedAxios.get.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('guarda credenciales cifrando el access token y deja estado pendiente', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.save.mockImplementation(async (config) => ({
      id: 'mp-config-id',
      ...config,
    }));

    const result = await service.guardarCredenciales({
      sucursalId: 'sucursal-1',
      accessToken: 'APP_USR-token',
      mpUserId: '123456789',
      mpPosId: 'ABC123',
      mpPosNombre: 'Caja 1 - Sucursal Centro',
    });

    expect(result).toEqual({ ok: true, id: 'mp-config-id' });
    expect(cifrado.cifrar).toHaveBeenCalledWith('APP_USR-token');
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        sucursalId: 'sucursal-1',
        accessTokenEnc: 'enc:APP_USR-token',
        mpUserId: '123456789',
        mpPosId: 'ABC123',
        mpPosNombre: 'Caja 1 - Sucursal Centro',
        estado: 'pendiente',
      }),
    );
  });

  it('devuelve error y actualiza estado cuando el token es invalido', async () => {
    const config = {
      sucursalId: 'sucursal-1',
      accessTokenEnc: 'enc-token',
      mpPosId: 'ABC123',
      estado: 'pendiente',
      ultimoError: null as string | null,
    };
    repo.findOne.mockResolvedValue(config);
    repo.save.mockResolvedValue(config);
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.get.mockRejectedValue({
      response: { data: { message: 'invalid_token' } },
      message: 'Request failed',
    });

    const result = await service.testConexion('sucursal-1');

    expect(result).toEqual({
      ok: false,
      estado: 'error',
      error: 'invalid_token',
    });
    expect(config.estado).toBe('error');
    expect(config.ultimoError).toBe('invalid_token');
    expect(repo.save).toHaveBeenCalledWith(config);
  });

  it('normaliza 401 sin mensaje como invalid_token', async () => {
    const config = {
      sucursalId: 'sucursal-1',
      accessTokenEnc: 'enc-token',
      mpPosId: 'ABC123',
      estado: 'pendiente',
      ultimoError: null as string | null,
    };
    repo.findOne.mockResolvedValue(config);
    repo.save.mockResolvedValue(config);
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.get.mockRejectedValue({
      response: { status: 401, data: { message: '' } },
      message: '',
    });

    await expect(service.testConexion('sucursal-1')).resolves.toEqual({
      ok: false,
      estado: 'error',
      error: 'invalid_token',
    });
  });
});
