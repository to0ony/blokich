import dayjs from 'dayjs';
import { praznikZa, uskrs } from './praznici';

describe('praznici', () => {
  it('računa datum Uskrsa', () => {
    const datumi: [number, string][] = [
      [2024, '2024-03-31'],
      [2025, '2025-04-20'],
      [2026, '2026-04-05'],
      [2027, '2027-03-28'],
      [2030, '2030-04-21'],
    ];
    for (const [godina, datum] of datumi) {
      expect(uskrs(godina).format('YYYY-MM-DD')).toBe(datum);
    }
  });

  it('prepoznaje pomične blagdane', () => {
    expect(praznikZa(dayjs('2026-04-05'))).toBe('Uskrs');
    expect(praznikZa(dayjs('2026-04-06'))).toBe('Uskrsni ponedjeljak');
    expect(praznikZa(dayjs('2026-06-04'))).toBe('Tijelovo');
    expect(praznikZa(dayjs('2027-05-27'))).toBe('Tijelovo');
  });

  it('prepoznaje fiksne blagdane u svakoj godini', () => {
    expect(praznikZa(dayjs('2026-11-01'))).toBe('Svi sveti');
    expect(praznikZa(dayjs('2031-12-25'))).toBe('Božić');
  });

  it('ima svih 14 blagdana u 2025. i 2026.', () => {
    for (const godina of [2025, 2026]) {
      const prvi = dayjs(`${godina}-01-01`);
      const dana = prvi.add(1, 'year').diff(prvi, 'day');
      const blagdani = Array.from({ length: dana }, (_, i) => prvi.add(i, 'day')).filter(praznikZa);
      expect(blagdani.length).toBe(14);
    }
    expect(praznikZa(dayjs('2025-04-21'))).toBe('Uskrsni ponedjeljak');
    expect(praznikZa(dayjs('2025-06-19'))).toBe('Tijelovo');
  });

  it('običan dan nije blagdan', () => {
    expect(praznikZa(dayjs('2026-11-04'))).toBeNull();
    expect(praznikZa(dayjs('2026-04-07'))).toBeNull();
  });
});
