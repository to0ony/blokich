import { Test, TestingModule } from '@nestjs/testing';
import { DisponentUploadController } from './disponent-upload.controller';

describe('DisponentUploadController', () => {
  let controller: DisponentUploadController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisponentUploadController],
    }).compile();

    controller = module.get<DisponentUploadController>(DisponentUploadController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
