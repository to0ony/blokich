import { SmjenaNaBloku, aktivniNaBlokovima, blokIz } from './vozaci-na-bloku.service';

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
