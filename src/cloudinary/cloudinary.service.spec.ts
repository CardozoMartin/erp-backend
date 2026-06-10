import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CloudinaryService } from './cloudinary.service';

describe('CloudinaryService', () => {
  let service: CloudinaryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudinaryService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string> = {
                CLOUDINARY_CLOUD_NAME: 'test-cloud',
                CLOUDINARY_API_KEY: 'test-key',
                CLOUDINARY_API_SECRET: 'test-secret',
              };
              return values[key];
            }),
          },
        },
      ],
    }).useMocker(() => ({})).compile();

    service = module.get<CloudinaryService>(CloudinaryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
