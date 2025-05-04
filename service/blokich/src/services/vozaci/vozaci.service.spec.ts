import { Test, TestingModule } from '@nestjs/testing';
import { VozaciService } from './vozaci.service';

describe('VozaciService', () => {
  let service: VozaciService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VozaciService],
    }).compile();

    service = module.get<VozaciService>(VozaciService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
