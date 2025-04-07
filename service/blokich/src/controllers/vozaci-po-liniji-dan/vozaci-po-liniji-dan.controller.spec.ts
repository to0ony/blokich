import { Test, TestingModule } from '@nestjs/testing';
import { VozaciPoLinijiDanController } from './vozaci-po-liniji-dan.controller';

describe('VozaciPoLinijiDanController', () => {
  let controller: VozaciPoLinijiDanController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VozaciPoLinijiDanController],
    }).compile();

    controller = module.get<VozaciPoLinijiDanController>(VozaciPoLinijiDanController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
