import { obradiRadove, obradiZatvaranja, parsirajPolyline, procijeniKraj } from './radovi.service';

const SAD = Date.parse('2026-11-09T12:00:00Z');

describe('parsirajPolyline', () => {
  it('lat lon parovi -> [lon, lat]', () => {
    expect(parsirajPolyline('45.79 16.02 45.80 16.03')).toEqual([
      [16.02, 45.79],
      [16.03, 45.8],
    ]);
  });
});

describe('obradiZatvaranja', () => {
  const z = (od: string, doo: string) => ({
    type: 'ROAD_CLOSED',
    street: 'Velika cesta',
    polyline: '45.7375 16.0025 45.7383 16.0030',
    direction: 'BOTH_DIRECTIONS',
    expectedStartTime: od,
    expectedEndTime: doo,
  });

  it('aktivno zatvaranje kao linija', () => {
    const [f] = obradiZatvaranja([z('2026-11-07T07:00:00+00:00', '2027-03-15T14:24:00+00:00')], SAD);
    expect(f.geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [16.0025, 45.7375],
        [16.003, 45.7383],
      ],
    });
    expect(f.properties).toMatchObject({ vrsta: 'zatvaranje', naslov: 'Velika cesta', aktivno: true });
  });

  it('završeno se ne prikazuje, uskoro se prikazuje kao neaktivno', () => {
    expect(obradiZatvaranja([z('2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z')], SAD)).toEqual([]);
    const [f] = obradiZatvaranja([z('2026-11-10T06:00:00Z', '2026-11-20T00:00:00Z')], SAD);
    expect(f.properties.aktivno).toBe(false);
    expect(obradiZatvaranja([z('2026-12-10T06:00:00Z', '2026-12-20T00:00:00Z')], SAD)).toEqual([]);
  });

  it('neispravan unos se preskače', () => {
    expect(obradiZatvaranja([{ polyline: '45.7' }, null] as any, SAD)).toEqual([]);
    expect(obradiZatvaranja(null as any, SAD)).toEqual([]);
  });
});

describe('obradiRadove', () => {
  const f = (status: string | null, Naslov: string, podnaslov: string) => ({
    type: 'Feature',
    properties: { status, Naslov, podnaslov, url: 'https://x' },
    geometry: { type: 'Point', coordinates: [15.9, 45.8] },
  });

  it('radovi u tijeku i planirani, bez HTML-a', () => {
    const r = obradiRadove({
      features: [
        f('u tijeku', 'Rekonstrukcija nadvožnjaka Odra', '📅 Kada?<br>Od 19. listopada'),
        f('planirano', 'Plinovod na Ilici', 'Početak planiran'),
      ],
    }, new Date(SAD));
    expect(r.map((x) => [x.properties.naslov, x.properties.aktivno])).toEqual([
      ['Rekonstrukcija nadvožnjaka Odra', true],
      ['Plinovod na Ilici', false],
    ]);
    expect(r[0].properties.opis).toBe('📅 Kada?\nOd 19. listopada');
  });

  it('završeni se izbacuju i kad status ne kaže', () => {
    const r = obradiRadove({
      features: [
        f('završeno', 'A', ''),
        f('2025', 'B', ''),
        f(null, 'C', '✅Radovi su završeni 25. svibnja 2026.'),
        f('u tijeku', 'D', '✅2. listopada Sarajevska cesta je puštena u promet!'),
        f('nepoznato', 'Blagdan Svih svetih 2025.', 'Regulacija'),
        f(null, 'E', '📅 Kada? Radovi predviđeni tijekom srpnja'),
        f(null, 'F', '📍 Gdje? X 📅 Kada? Od 31. kolovoza do 5. rujna'),
      ],
    }, new Date(SAD));
    expect(r).toEqual([]);
  });

  it('rok koji još traje ostaje, s procijenjenim krajem', () => {
    const [r] = obradiRadove(
      { features: [f('u tijeku', 'Lončara', '📅 Kada? Od 7. rujna do 7. prosinca')] },
      new Date(SAD),
    );
    expect(r.properties.do).toBe('2026-12-07T23:59:00.000Z');
  });
});

describe('procijeniKraj', () => {
  const sad = new Date(SAD);
  it.each([
    ['📅 Kada? Od 12. listopada do 8. studenoga 2026.', '2026-11-08T23:59:00.000Z'],
    ['📅 Kada? Od 9.3. do 4.4.2026.', '2026-04-04T23:59:00.000Z'],
    ['📅 Kada? Od 1.6. do 15.8.', '2026-08-15T23:59:00.000Z'],
    ['📅 Kada? Radovi predviđeni tijekom listopada', '2026-10-31T23:59:00.000Z'],
    ['📅 Kada? Radovi predviđeni od svibnja do kolovoza', '2026-08-31T23:59:00.000Z'],
  ])('%s', (tekst, ocekivano) => {
    expect(procijeniKraj(tekst, sad)?.toISOString()).toBe(ocekivano);
  });

  it('bez roka = null', () => {
    expect(procijeniKraj('📅 Kada? Predviđeni završetak radova je ljeto 2027.', sad)).toBeNull();
  });
});
