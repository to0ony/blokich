import { Test, TestingModule } from '@nestjs/testing';
import { GodisnjiService } from './godisnji.service';

describe('GodisnjiService', () => {
  let service: GodisnjiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GodisnjiService],
    }).compile();

    service = module.get<GodisnjiService>(GodisnjiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
