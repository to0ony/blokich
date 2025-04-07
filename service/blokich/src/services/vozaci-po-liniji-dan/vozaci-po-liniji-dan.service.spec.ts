import { Test, TestingModule } from '@nestjs/testing';
import { VozaciPoLinijiService } from './vozaci-po-liniji-dan.service';

describe('VozaciPoLinijiDanService', () => {
  let service: VozaciPoLinijiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VozaciPoLinijiService],
    }).compile();

    service = module.get<VozaciPoLinijiService>(VozaciPoLinijiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
