import { geometrijskiManevri, osrmManevri } from './navigacija.service';

const KX = 111_320 * Math.cos((45.81 * Math.PI) / 180);
const KY = 110_540;
/** Točka x, y metara od ishodišta kao [lat, lon]. */
const pt = (x: number, y: number): [number, number] => [45.8 + y / KY, 15.9 + x / KX];
const ll = (x: number, y: number): [number, number] => [15.9 + x / KX, 45.8 + y / KY];

describe('geometrijskiManevri', () => {
  it('ravna trasa nema skretanja', () => {
    expect(geometrijskiManevri([pt(0, 0), pt(500, 0), pt(1000, 0)])).toEqual([]);
  });

  it('istok pa sjever = lijevo, pa istok = desno', () => {
    const m = geometrijskiManevri([pt(0, 0), pt(400, 0), pt(400, 400), pt(800, 400)]);
    expect(m.map((x) => x.tip)).toEqual(['lijevo', 'desno']);
    expect(Math.abs(m[0].d - 400)).toBeLessThan(25);
    expect(Math.abs(m[1].d - 800)).toBeLessThan(25);
    expect(m[0].ulica).toBeNull();
  });

  it('blagi zavoj', () => {
    // Istok pa sjeveroistok (45°).
    const m = geometrijskiManevri([pt(0, 0), pt(400, 0), pt(800, 400)]);
    expect(m.map((x) => x.tip)).toEqual(['blago-lijevo']);
  });
});

describe('osrmManevri', () => {
  const trasa = [pt(0, 0), pt(400, 0), pt(400, 400)];
  const ruta = (geom: [number, number][], steps: any[]) => ({
    geometry: { coordinates: geom },
    legs: [{ steps }],
  });

  it('skretanje s imenom ulice, smješteno na trasu', () => {
    const m = osrmManevri(trasa, [
      ruta(
        [ll(0, 0), ll(200, 0), ll(400, 0), ll(400, 200), ll(400, 400)],
        [
          { maneuver: { type: 'depart', location: ll(0, 0) }, name: 'Ilica' },
          { maneuver: { type: 'turn', modifier: 'left', location: ll(400, 0) }, name: 'Vrapčanska' },
          { maneuver: { type: 'arrive', location: ll(400, 400) }, name: '' },
        ],
      ),
    ]);
    expect(m).toEqual([{ d: 400, tip: 'lijevo', ulica: 'Vrapčanska' }]);
  });

  it('kružni tok s izlazom', () => {
    const m = osrmManevri(trasa, [
      ruta([ll(0, 0), ll(400, 0), ll(400, 400)], [
        { maneuver: { type: 'roundabout', modifier: 'left', exit: 2, location: ll(400, 0) }, name: 'Vrapčanska' },
      ]),
    ]);
    expect(m).toEqual([{ d: 400, tip: 'kruzni', ulica: 'Vrapčanska', izlaz: 2 }]);
  });

  it('ruta koja ide drugim putem se odbacuje', () => {
    const m = osrmManevri(trasa, [
      ruta([ll(0, 0), ll(0, 300), ll(0, 600), ll(400, 600), ll(400, 400)], []),
    ]);
    expect(m).toBeNull();
  });
});
