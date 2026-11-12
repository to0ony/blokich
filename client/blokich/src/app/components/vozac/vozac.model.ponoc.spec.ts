import dayjs from 'dayjs';
import {
  Kolega,
  Sluzba,
  aktivniDan,
  aktivniPoBloku,
  lanacSluzbi,
  stanjeSluzbe,
  sutraKratko,
  uSmjeniSad,
} from './vozac.model';

/** Četvrtak 12.11.2026. / petak 13.11. u zadano vrijeme (lokalno). */
const cet = (hhmm: string) => new Date(`2026-11-12T${hhmm}:00`);
const pet = (hhmm: string) => new Date(`2026-11-13T${hhmm}:00`);

const sluzba = (od: string, doo: string, linija = '132', br_sl = '207'): Sluzba => ({
  br_sl,
  linija,
  varijanta: '1',
  od,
  do: doo,
});
const dan = (datum: string, sluzbe: Sluzba[]) => ({ datum: dayjs(datum), sluzbe });

describe('lanac dijelova službe', () => {
  it('dio nakon ponoći je sutradan, malo preklapanje nije', () => {
    expect(lanacSluzbi([sluzba('21:50', '01:40'), sluzba('01:45', '04:20')])).toEqual([
      { pocetak: 1310, kraj: 1540 },
      { pocetak: 1545, kraj: 1700 },
    ]);
    expect(lanacSluzbi([sluzba('05:00', '13:05'), sluzba('13:00', '17:00')])[1]).toEqual({
      pocetak: 780,
      kraj: 1020,
    });
  });

  it('uSmjeniSad: dio sam za sebe, samo svoj dan', () => {
    expect(uSmjeniSad('20:00', '01:30', cet('00:45'))).toBeFalse();
    expect(uSmjeniSad('20:00', '01:30', cet('23:00'))).toBeTrue();
  });

  it('sutraKratko', () => {
    expect(sutraKratko(dayjs('2026-11-12'))).toBe('pet');
    expect(sutraKratko(dayjs('2026-11-15'))).toBe('pon');
  });
});

describe('noćna služba u dva dijela (21:50–01:40, 01:45–04:20)', () => {
  const prvi = sluzba('21:50', '01:40', '132');
  const drugi = sluzba('01:45', '04:20', '118', '207P');
  const cetvrtak = dan('2026-11-12', [prvi, drugi]);
  const petak = dan('2026-11-13', [sluzba('14:00', '22:00', '109')]);

  it('četvrtak navečer: prvi dio vozi, drugi tek dolazi (sutradan)', () => {
    expect(stanjeSluzbe(cetvrtak, prvi, cet('22:30'))).toEqual({
      uTijeku: true,
      za: null,
      gotovo: false,
      sutradan: false,
    });
    expect(stanjeSluzbe(cetvrtak, drugi, cet('22:30'))).toEqual({
      uTijeku: false,
      za: 195,
      gotovo: false,
      sutradan: true,
    });
  });

  it('četvrtak rano ujutro (prije službe): ništa nije u tijeku', () => {
    expect(stanjeSluzbe(cetvrtak, drugi, cet('02:30')).uTijeku).toBeFalse();
    expect(stanjeSluzbe(cetvrtak, prvi, cet('00:45')).uTijeku).toBeFalse();
  });

  it('petak nakon ponoći: dan ostaje četvrtak do kraja drugog dijela', () => {
    expect(aktivniDan([cetvrtak, petak], pet('01:20'))).toBe(cetvrtak);
    expect(aktivniDan([cetvrtak, petak], pet('01:42'))).toBe(cetvrtak);
    expect(aktivniDan([cetvrtak, petak], pet('02:30'))).toBe(cetvrtak);
    expect(aktivniDan([cetvrtak, petak], pet('04:20'))).toBe(petak);
  });

  it('petak 02:30: prvi odvožen, drugi u tijeku', () => {
    expect(stanjeSluzbe(cetvrtak, prvi, pet('02:30')).gotovo).toBeTrue();
    expect(stanjeSluzbe(cetvrtak, drugi, pet('02:30')).uTijeku).toBeTrue();
  });

  it('pauza 01:42: drugi dio kreće za 3 min', () => {
    expect(stanjeSluzbe(cetvrtak, drugi, pet('01:42')).za).toBe(3);
  });

  it('bez noćne službe dan je uvijek današnji', () => {
    const dnevni = dan('2026-11-12', [sluzba('06:00', '14:00')]);
    expect(aktivniDan([dnevni, petak], pet('00:10'))).toBe(petak);
  });

  it('kolege: drugi dio jučerašnje službe vozi nakon ponoći', () => {
    const k = (s: Sluzba, sluz_broj: string): Kolega => ({
      sluz_broj,
      ime_prezime: null,
      br_sl: s.br_sl,
      linija: s.linija,
      'V.R': s.varijanta,
      od: s.od,
      do: s.do,
    });
    // Poredak kao nakon sortiranja po "od": 01:45 prije 21:50 – lanac ide po 207/207P.
    const kolege = [k(drugi, '00007'), k(prvi, '00007')];
    const datum = dayjs('2026-11-12');
    expect(aktivniPoBloku(kolege, datum, pet('02:30')).get('11801')?.sluz_broj).toBe('00007');
    expect(aktivniPoBloku(kolege, datum, pet('02:30')).has('13201')).toBeFalse();
    expect(aktivniPoBloku(kolege, datum, cet('02:30')).size).toBe(0);
  });
});
