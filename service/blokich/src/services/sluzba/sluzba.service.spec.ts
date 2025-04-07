import { Test, TestingModule } from '@nestjs/testing';
import { SluzbaService } from './sluzba.service';

describe('SluzbaService', () => {
  let service: SluzbaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SluzbaService],
    }).compile();

    service = module.get<SluzbaService>(SluzbaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
