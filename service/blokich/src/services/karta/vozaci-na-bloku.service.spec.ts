import { SmjenaNaBloku, aktivniNaBlokovima, blokIz, lanacSluzbi } from './vozaci-na-bloku.service';

const s = (blok: string, od: string, doo: string, sluz_broj = '00001'): SmjenaNaBloku => ({
  blok,
  od,
  do: doo,
  sluz_broj,
  ime: `Vozač ${sluz_broj}`,
  kontakt: null,
  br_sl: '1',
});
const m = (hhmm: string) => {
  const [h, mm] = hhmm.split(':').map(Number);
  return h * 60 + mm;
};

describe('blokIz', () => {
  it('linija + V.R. s dvije znamenke', () => {
    expect(blokIz('109', '2')).toBe('10902');
    expect(blokIz('109', '10')).toBe('10910');
    expect(blokIz('N', '2')).toBeNull();
  });
});

describe('aktivniNaBlokovima', () => {
  it('vozač u smjeni sad', () => {
    const r = aktivniNaBlokovima([s('10902', '05:00', '13:00')], [], m('08:00'));
    expect(r.get('10902')?.sluz_broj).toBe('00001');
  });

  it('u minuti predaje vozi onaj koji preuzima', () => {
    const r = aktivniNaBlokovima(
      [s('10902', '05:00', '13:00', '00001'), s('10902', '13:00', '21:00', '00002')],
      [],
      m('13:00'),
    );
    expect(r.get('10902')?.sluz_broj).toBe('00002');
  });

  it('kod preklapanja vozi onaj koji je ranije počeo', () => {
    const r = aktivniNaBlokovima(
      [s('10902', '05:00', '13:10', '00001'), s('10902', '12:50', '21:00', '00002')],
      [],
      m('13:00'),
    );
    expect(r.get('10902')?.sluz_broj).toBe('00001');
  });

  it('jučerašnja služba preko ponoći vrijedi do kraja', () => {
    const jucer = [s('10902', '22:00', '01:30', '00007')];
    expect(aktivniNaBlokovima([], jucer, m('00:45')).get('10902')?.sluz_broj).toBe('00007');
    expect(aktivniNaBlokovima([], jucer, m('01:30')).size).toBe(0);
  });

  it('jučerašnja dnevna služba se ne računa', () => {
    expect(aktivniNaBlokovima([], [s('10902', '05:00', '13:00')], m('08:00')).size).toBe(0);
  });

  it('izvan smjene nema nikoga', () => {
    expect(aktivniNaBlokovima([s('10902', '05:00', '13:00')], [], m('14:00')).size).toBe(0);
  });
});

describe('lanacSluzbi', () => {
  it('dio nakon ponoći ide u sljedeći dan', () => {
    expect(
      lanacSluzbi([
        { od: '21:50', do: '01:40' },
        { od: '01:45', do: '04:20' },
      ]),
    ).toEqual([
      { pocetak: m('21:50'), kraj: m('01:40') + 1440 },
      { pocetak: m('01:45') + 1440, kraj: m('04:20') + 1440 },
    ]);
  });

  it('preklapanje kod predaje nije novi dan', () => {
    expect(
      lanacSluzbi([
        { od: '05:00', do: '13:05' },
        { od: '13:00', do: '17:00' },
      ])[1],
    ).toEqual({ pocetak: m('13:00'), kraj: m('17:00') });
  });

  it('prvi dio vrijedi za svoj dan, i nakon ponoći', () => {
    expect(lanacSluzbi([{ od: '00:30', do: '06:00' }])[0]).toEqual({
      pocetak: m('00:30'),
      kraj: m('06:00'),
    });
  });
});

describe('aktivniNaBlokovima – dijelovi službe nakon ponoći', () => {
  const [a, b] = lanacSluzbi([
    { od: '21:50', do: '01:40' },
    { od: '01:45', do: '04:20' },
  ]);
  const jucer = [
    { ...s('13201', '21:50', '01:40', '00007'), ...a! },
    { ...s('11803', '01:45', '04:20', '00007'), ...b! },
  ];

  it('drugi dio jučerašnje službe vozi se nakon ponoći', () => {
    expect(aktivniNaBlokovima([], jucer, m('02:30')).get('11803')?.sluz_broj).toBe('00007');
    expect(aktivniNaBlokovima([], jucer, m('04:20')).size).toBe(0);
  });

  it('isti dio se ne računa rano ujutro dana službe', () => {
    expect(aktivniNaBlokovima(jucer, [], m('02:30')).size).toBe(0);
  });

  it('pomoćna polja ne idu van', () => {
    const v = aktivniNaBlokovima([], jucer, m('00:30')).get('13201');
    expect(v).toEqual({
      sluz_broj: '00007',
      ime: 'Vozač 00007',
      kontakt: null,
      br_sl: '1',
      od: '21:50',
      do: '01:40',
    });
  });
});
