import { Test, TestingModule } from '@nestjs/testing';
import { VozaciPoSluzbiDanController } from './vozaci-po-sluzbi-dan.controller';

describe('VozaciPoSluzbiDanController', () => {
  let controller: VozaciPoSluzbiDanController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VozaciPoSluzbiDanController],
    }).compile();

    controller = module.get<VozaciPoSluzbiDanController>(VozaciPoSluzbiDanController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
