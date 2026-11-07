import { pauzaMinuta, satiSluzbe, trajanjeTekst } from './vozac.model';

describe('sati i pauze dvodijelne službe', () => {
  it('satiSluzbe uzima sate jednom, iz prvog dijela koji ih ima', () => {
    expect(
      satiSluzbe([
        { ukupni_sati: '9,67', efektivni_sati: '08:00', nocni_rad: '0,00' },
        { ukupni_sati: '9,67', efektivni_sati: '08:00', nocni_rad: '0,00' },
      ]),
    ).toEqual({
      ukupni_sati: '9,67',
      efektivni_sati: '08:00',
      nocni_rad: '0,00',
      druga_smjena: undefined,
    });
    expect(
      satiSluzbe([{ ukupni_sati: '' }, { ukupni_sati: '8,17' }]).ukupni_sati,
    ).toBe('8,17');
  });

  it('pauzaMinuta računa razmak i preko ponoći', () => {
    expect(pauzaMinuta('17:55', '18:25')).toBe(30);
    expect(pauzaMinuta('23:40', '00:10')).toBe(30);
    expect(pauzaMinuta('08:55', '15:10')).toBe(375);
    expect(pauzaMinuta('08:00', '08:00')).toBe(0);
    expect(pauzaMinuta(undefined, '08:00')).toBeNull();
  });

  it('trajanjeTekst', () => {
    expect(trajanjeTekst(30)).toBe('30 min');
    expect(trajanjeTekst(220)).toBe('3 h 40 min');
    expect(trajanjeTekst(240)).toBe('4 h');
  });
});
