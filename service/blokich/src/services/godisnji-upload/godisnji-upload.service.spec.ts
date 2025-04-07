import { Test, TestingModule } from '@nestjs/testing';
import { GodisnjiUploadService } from './godisnji-upload.service';

describe('GodisnjiUploadService', () => {
  let service: GodisnjiUploadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GodisnjiUploadService],
    }).compile();

    service = module.get<GodisnjiUploadService>(GodisnjiUploadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
