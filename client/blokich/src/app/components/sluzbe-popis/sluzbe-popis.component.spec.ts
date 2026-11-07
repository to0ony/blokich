import { grupiraj } from './sluzbe-popis.component';

describe('grupiraj (pregled službi)', () => {
  it('spaja "79" i "79P" u jednu službu i računa trajanje dijelova', () => {
    const [g] = grupiraj([
      { br_sl: '79P', linija: '140', od: '08:30', do: '13:50' },
      {
        br_sl: '79',
        linija: '140',
        od: '05:50',
        do: '08:00',
        efektivni_sati: '07:30',
      },
    ]);

    expect(g.broj).toBe('79');
    expect(g.dijelovi.map((d) => d.br_sl)).toEqual(['79', '79P']);
    expect(g.dijelovi.map((d) => d.trajanje)).toEqual([130, 320]);
    expect(g.prvi.efektivni_sati).toBe('07:30');
    expect(g.linije).toEqual(['140']);
  });

  it('dio preko ponoći ima pozitivno trajanje', () => {
    const [g] = grupiraj([{ br_sl: '901', od: '18:00', do: '00:55' }]);
    expect(g.dijelovi[0].trajanje).toBe(415);
  });

  it('sortira po broju službe, ne abecedno', () => {
    const brojevi = grupiraj([
      { br_sl: '100' },
      { br_sl: '9' },
      { br_sl: '21' },
    ]).map((g) => g.broj);
    expect(brojevi).toEqual(['9', '21', '100']);
  });

  it('skuplja dane i linije iz svih dijelova', () => {
    const [g] = grupiraj([
      { br_sl: '361', linija: '112', dani: ['RADNI_DAN'] },
      { br_sl: '361P', linija: '401', dani: ['RADNI_DAN', 'NEDJELJA'] },
    ]);
    expect(g.dani).toEqual(['RADNI_DAN', 'NEDJELJA']);
    expect(g.linije).toEqual(['112', '401']);
    expect(g.pretraga).toContain('401');
  });
});
