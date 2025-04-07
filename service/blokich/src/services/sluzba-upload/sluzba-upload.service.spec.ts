import { Test, TestingModule } from '@nestjs/testing';
import { SluzbaUploadService } from './sluzba-upload.service';

describe('SluzbaUploadService', () => {
  let service: SluzbaUploadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SluzbaUploadService],
    }).compile();

    service = module.get<SluzbaUploadService>(SluzbaUploadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
