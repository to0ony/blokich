/**
 * Visina sunca nad obzorom (stupnjevi) za dano vrijeme i mjesto – dovoljno
 * točno (±1°) da navigacija zna je li dan ili noć.
 */
export function visinaSunca(datum: Date, lat: number, lon: number): number {
  const rad = Math.PI / 180;
  // Dani od J2000.0 (1. 1. 2000. 12:00 UTC).
  const d = datum.getTime() / 86_400_000 - 10_957.5;
  const g = (357.529 + 0.98560028 * d) * rad;
  const q = 280.459 + 0.98564736 * d;
  const l = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l));
  const dec = Math.asin(Math.sin(e) * Math.sin(l));
  const gmst = (18.697374558 + 24.06570982441908 * d) * 15;
  const h = (gmst + lon) * rad - ra;
  const fi = lat * rad;
  return Math.asin(Math.sin(fi) * Math.sin(dec) + Math.cos(fi) * Math.cos(dec) * Math.cos(h)) / rad;
}

/** Noć: sunce malo ispod obzora (kad je već sumrak, tamna karta manje bliješti). */
export function jeNoc(datum: Date, lat: number, lon: number): boolean {
  return visinaSunca(datum, lat, lon) < -2;
}
