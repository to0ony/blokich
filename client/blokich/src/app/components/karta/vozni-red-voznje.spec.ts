import { kasnjenje, minuteNaTrasi, odaberiPolazak, sljedeciPolazak, uMinute, uSate } from './vozni-red-voznje';

describe('vozni red vožnje', () => {
  const udaljenosti = [0, 1000, 3000];
  const vremena = [0, 2, 8];

  it('minute po trasi se računaju između stajališta', () => {
    expect(minuteNaTrasi(0, udaljenosti, vremena)).toBe(0);
    expect(minuteNaTrasi(500, udaljenosti, vremena)).toBe(1);
    expect(minuteNaTrasi(2000, udaljenosti, vremena)).toBe(5);
    expect(minuteNaTrasi(9000, udaljenosti, vremena)).toBe(8);
  });

  it('odabire polazak s najmanjim odstupanjem', () => {
    const polasci = ['10:00', '10:10', '10:20'].map((x) => uMinute(x)!);
    // Na 5. minuti trase u 10:17 → polazak 10:10 (+2 min).
    const p = odaberiPolazak(polasci, 5, uMinute('10:17')!);
    expect(p).toBe(uMinute('10:10'));
    expect(kasnjenje(p!, 5, uMinute('10:17')!)).toBe(2);
  });

  it('nema polaska ako su svi daleko', () => {
    expect(odaberiPolazak([uMinute('06:00')!], 0, uMinute('12:00')!)).toBeNull();
  });

  it('preko ponoći', () => {
    expect(kasnjenje(uMinute('23:58')!, 4, uMinute('00:03')!)).toBe(1);
    expect(sljedeciPolazak([uMinute('00:10')!], uMinute('23:55')!)).toEqual({ vrijeme: '00:10', za: 15 });
    expect(uSate(1445)).toBe('00:05');
  });
});
