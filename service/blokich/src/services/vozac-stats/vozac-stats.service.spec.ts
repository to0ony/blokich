import { Test, TestingModule } from '@nestjs/testing';
import { VozacStatsService } from './vozac-stats.service';

describe('VozacStatsService', () => {
  let service: VozacStatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VozacStatsService],
    }).compile();

    service = module.get<VozacStatsService>(VozacStatsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
