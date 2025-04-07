import { Test, TestingModule } from '@nestjs/testing';
import { GodisnjiController } from './godisnji.controller';

describe('GodisnjiController', () => {
  let controller: GodisnjiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GodisnjiController],
    }).compile();

    controller = module.get<GodisnjiController>(GodisnjiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
