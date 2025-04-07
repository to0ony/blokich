import { Test, TestingModule } from '@nestjs/testing';
import { SluzbaController } from './sluzba.controller';

describe('SluzbaController', () => {
  let controller: SluzbaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SluzbaController],
    }).compile();

    controller = module.get<SluzbaController>(SluzbaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
