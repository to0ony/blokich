import { Test, TestingModule } from '@nestjs/testing';
import { DisponentController } from './disponent.controller';

describe('DisponentController', () => {
  let controller: DisponentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisponentController],
    }).compile();

    controller = module.get<DisponentController>(DisponentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
