import dayjs from 'dayjs';
import { Sluzba, aktivniDan, stanjeSluzbe, uSmjeniSad } from './vozac.model';

/** Četvrtak 12.11.2026. u zadano vrijeme (lokalno). */
const cet = (hhmm: string) => new Date(`2026-11-12T${hhmm}:00`);
const pet = (hhmm: string) => new Date(`2026-11-13T${hhmm}:00`);

const sluzba = (od: string, doo: string): Sluzba => ({ br_sl: '1', linija: '132', varijanta: '1', od, do: doo });
const dan = (datum: string, sluzbe: Sluzba[]) => ({ datum: dayjs(datum), sluzbe });

describe('službe preko ponoći', () => {
  const nocna = sluzba('20:00', '01:30');
  const cetvrtak = dan('2026-11-12', [nocna]);
  const petak = dan('2026-11-13', [sluzba('14:00', '22:00')]);

  it('uSmjeniSad: svoj dan od početka do ponoći, sutradan do kraja', () => {
    expect(uSmjeniSad('20:00', '01:30', cet('00:45'))).toBeFalse();
    expect(uSmjeniSad('20:00', '01:30', cet('23:00'))).toBeTrue();
    expect(uSmjeniSad('20:00', '01:30', pet('00:45'), true)).toBeTrue();
    expect(uSmjeniSad('20:00', '01:30', pet('01:30'), true)).toBeFalse();
    // Dnevna služba od jučer više ne traje.
    expect(uSmjeniSad('06:00', '14:00', pet('07:00'), true)).toBeFalse();
  });

  it('aktivniDan: jučer dok noćna traje, zatim danas', () => {
    expect(aktivniDan([cetvrtak, petak], cet('23:00'))).toBe(cetvrtak);
    expect(aktivniDan([cetvrtak, petak], pet('00:45'))).toBe(cetvrtak);
    expect(aktivniDan([cetvrtak, petak], pet('01:30'))).toBe(petak);
    expect(aktivniDan([cetvrtak, petak], pet('10:00'))).toBe(petak);
  });

  it('aktivniDan: bez noćne službe uvijek danas', () => {
    const dnevni = dan('2026-11-12', [sluzba('06:00', '14:00')]);
    expect(aktivniDan([dnevni, petak], pet('00:10'))).toBe(petak);
  });

  it('stanjeSluzbe: jučerašnja noćna traje i ne kreće ponovno', () => {
    expect(stanjeSluzbe(cetvrtak, nocna, pet('00:45'))).toEqual({ uTijeku: true, za: null });
    expect(stanjeSluzbe(cetvrtak, nocna, cet('19:30'))).toEqual({ uTijeku: false, za: 30 });
    expect(stanjeSluzbe(cetvrtak, nocna, cet('00:45'))).toEqual({ uTijeku: false, za: 1155 });
  });
});
