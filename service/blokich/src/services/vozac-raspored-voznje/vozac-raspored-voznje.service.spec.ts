import { Test, TestingModule } from '@nestjs/testing';
import { VozacRasporedVoznjeService } from './vozac-raspored-voznje.service';

describe('VozacRasporedVoznjeService', () => {
  let service: VozacRasporedVoznjeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VozacRasporedVoznjeService],
    }).compile();

    service = module.get<VozacRasporedVoznjeService>(VozacRasporedVoznjeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
