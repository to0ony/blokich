import { Test, TestingModule } from '@nestjs/testing';
import { SluzbaUploadController } from './sluzba-upload.controller';

describe('SluzbaUploadController', () => {
  let controller: SluzbaUploadController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SluzbaUploadController],
    }).compile();

    controller = module.get<SluzbaUploadController>(SluzbaUploadController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
