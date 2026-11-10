import { ManevarKarta } from '../../services/karta.service';

/** "350 m", "1,2 km" – zaokruženo kao na navigaciji. */
export function opisUdaljenosti(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
  if (m >= 300) return `${Math.round(m / 50) * 50} m`;
  return `${Math.max(10, Math.round(m / 10) * 10)} m`;
}

/** Za govor: "200 metara", "1,2 kilometra". */
function udaljenostGovor(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace('.', ',')} kilometra`;
  return `${Math.max(10, Math.round(m / 50) * 50 || Math.round(m / 10) * 10)} metara`;
}

/** "Skrenite desno", "Na kružnom toku 3. izlaz"… */
export function opisManevra(m: Pick<ManevarKarta, 'tip' | 'izlaz'>): string {
  switch (m.tip) {
    case 'lijevo':
      return 'Skrenite lijevo';
    case 'desno':
      return 'Skrenite desno';
    case 'blago-lijevo':
      return 'Blago lijevo';
    case 'blago-desno':
      return 'Blago desno';
    case 'ostro-lijevo':
      return 'Oštro lijevo';
    case 'ostro-desno':
      return 'Oštro desno';
    case 'polukruzno':
      return 'Okrenite se';
    case 'kruzni':
      return m.izlaz ? `Na kružnom toku ${m.izlaz}. izlaz` : 'Kružni tok';
  }
}

/** Najava manevra: "Za 200 metara skrenite desno, Ilica." */
export function govorManevra(m: ManevarKarta, metara: number | null): string {
  const radnja = opisManevra(m);
  const ulica = m.ulica ? `, ${m.ulica}` : '';
  if (metara === null) return `${radnja}${ulica}.`;
  return `Za ${udaljenostGovor(metara)} ${radnja.charAt(0).toLowerCase()}${radnja.slice(1)}${ulica}.`;
}

/** Kut strelice za manevar (0 = ravno, + = desno). */
export function kutStrelice(tip: ManevarKarta['tip']): number {
  switch (tip) {
    case 'lijevo':
      return -90;
    case 'desno':
      return 90;
    case 'blago-lijevo':
      return -45;
    case 'blago-desno':
      return 45;
    case 'ostro-lijevo':
      return -135;
    case 'ostro-desno':
      return 135;
    case 'polukruzno':
      return 180;
    default:
      return 0;
  }
}
