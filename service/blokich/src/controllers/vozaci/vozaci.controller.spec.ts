import { Test, TestingModule } from '@nestjs/testing';
import { VozaciController } from './vozaci.controller';

describe('VozaciController', () => {
  let controller: VozaciController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VozaciController],
    }).compile();

    controller = module.get<VozaciController>(VozaciController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
