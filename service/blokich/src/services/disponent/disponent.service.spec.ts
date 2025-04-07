import { Test, TestingModule } from '@nestjs/testing';
import { DisponentService } from './disponent.service';

describe('DisponentService', () => {
  let service: DisponentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DisponentService],
    }).compile();

    service = module.get<DisponentService>(DisponentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
