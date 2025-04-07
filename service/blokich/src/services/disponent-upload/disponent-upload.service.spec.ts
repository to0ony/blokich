import { Test, TestingModule } from '@nestjs/testing';
import { DisponentUploadService } from './disponent-upload.service';

describe('DisponentUploadService', () => {
  let service: DisponentUploadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DisponentUploadService],
    }).compile();

    service = module.get<DisponentUploadService>(DisponentUploadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
