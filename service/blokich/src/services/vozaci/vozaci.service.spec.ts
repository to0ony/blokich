import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { VozaciService } from './vozaci.service';

const vozaci = [
  { sluz_broj: '31433', ime_prezime: 'Ivo Ivić' },
  { sluz_broj: '314', ime_prezime: 'Ana Anić' },
  { sluz_broj: '31402', ime_prezime: 'Šime Šimić' },
  { sluz_broj: '466', ime_prezime: 'Marko Marić' },
  { sluz_broj: '3738824', ime_prezime: 'Pero Perić' },
];

describe('VozaciService', () => {
  let service: VozaciService;

  beforeEach(async () => {
    const godisnjiModel = {
      findOne: () => ({
        sort: () => ({ lean: () => Promise.resolve({ vozaci }) }),
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VozaciService,
        { provide: getModelToken('Godisnji'), useValue: godisnjiModel },
      ],
    }).compile();

    service = module.get<VozaciService>(VozaciService);
  });

  it('brojke traže po početku broja, točan broj prvi, ostali po redu', async () => {
    const r = await service.search('314');
    expect(r.map((v) => v.sluz_broj)).toEqual(['314', '31402', '31433']);
  });

  it('vodeće nule se ne broje', async () => {
    const r = await service.search('00466');
    expect(r.map((v) => v.sluz_broj)).toEqual(['466']);
  });

  it('limit ograničava broj prijedloga', async () => {
    const r = await service.search('3', 2);
    expect(r).toHaveLength(2);
  });

  it('ime bez kvačica i velikih slova', async () => {
    const r = await service.search('simic');
    expect(r).toEqual([{ sluz_broj: '31402', ime_prezime: 'Šime Šimić' }]);
  });
});
