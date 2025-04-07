import { Test, TestingModule } from '@nestjs/testing';
import { VozacStatsController } from './vozac-stats.controller';

describe('VozacStatsController', () => {
  let controller: VozacStatsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VozacStatsController],
    }).compile();

    controller = module.get<VozacStatsController>(VozacStatsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
