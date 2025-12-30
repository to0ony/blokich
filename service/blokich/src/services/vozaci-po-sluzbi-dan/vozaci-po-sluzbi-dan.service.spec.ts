import { Test, TestingModule } from '@nestjs/testing';
import { VozaciPoSluzbiDanService } from './vozaci-po-sluzbi-dan.service';

describe('VozaciPoSluzbiDanService', () => {
  let service: VozaciPoSluzbiDanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VozaciPoSluzbiDanService],
    }).compile();

    service = module.get<VozaciPoSluzbiDanService>(VozaciPoSluzbiDanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
