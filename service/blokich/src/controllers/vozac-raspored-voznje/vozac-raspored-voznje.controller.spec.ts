import { Test, TestingModule } from '@nestjs/testing';
import { VozacRasporedVoznjeController } from './vozac-raspored-voznje.controller';

describe('VozacRasporedVoznjeController', () => {
  let controller: VozacRasporedVoznjeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VozacRasporedVoznjeController],
    }).compile();

    controller = module.get<VozacRasporedVoznjeController>(VozacRasporedVoznjeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
