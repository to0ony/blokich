import { Test, TestingModule } from '@nestjs/testing';
import { GodisnjiUploadController } from './godisnji-upload.controller';

describe('GodisnjiUploadController', () => {
  let controller: GodisnjiUploadController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GodisnjiUploadController],
    }).compile();

    controller = module.get<GodisnjiUploadController>(GodisnjiUploadController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
