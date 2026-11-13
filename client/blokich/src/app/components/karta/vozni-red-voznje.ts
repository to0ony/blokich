/** Vozni red za navigaciju: kasnjenje, preostalo vrijeme, sljedeći polazak. */

/** "14:32" -> 872 */
export function uMinute(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  return m ? +m[1] * 60 + +m[2] : null;
}

/** 872 -> "14:32" (i preko ponoći). */
export function uSate(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Minute od ponoći, s dijelom minute. */
export function sadMinute(datum = new Date()): number {
  return datum.getHours() * 60 + datum.getMinutes() + datum.getSeconds() / 60;
}

/** Razlika dvaju vremena dana u minutama, u rasponu [-720, 720). */
function razlika(a: number, b: number): number {
  return ((((a - b) % 1440) + 2160) % 1440) - 720;
}

/**
 * Minute od polaska do točke d (m) na trasi: između stajališta linearno.
 * `udaljenosti` i `vremena` idu po stajalištima, istim redom.
 */
export function minuteNaTrasi(d: number, udaljenosti: number[], vremena: number[]): number {
  const n = Math.min(udaljenosti.length, vremena.length);
  if (!n) return 0;
  if (d <= udaljenosti[0]) return vremena[0];
  for (let i = 1; i < n; i++) {
    if (d <= udaljenosti[i]) {
      const raspon = udaljenosti[i] - udaljenosti[i - 1];
      const k = raspon > 0 ? (d - udaljenosti[i - 1]) / raspon : 1;
      return vremena[i - 1] + (vremena[i] - vremena[i - 1]) * k;
    }
  }
  return vremena[n - 1];
}

/** Bus ne kasni više od ovoga ni ne poranjuje više od ovoga – inače je to druga vožnja. */
const NAJVISE_KASNI = 40;
const NAJVISE_RANIJE = 15;

/**
 * Kojim polaskom vozač vjerojatno vozi: onaj po kojem bi na ovoj točki
 * trase najmanje kasnio ili poranio. Null ako nijedan nije blizu.
 */
export function odaberiPolazak(polasci: number[], minuteDoTocke: number, sad: number): number | null {
  let najbolji: number | null = null;
  let najmanje = Infinity;
  for (const p of polasci) {
    const k = razlika(sad, p + minuteDoTocke);
    if (k > NAJVISE_KASNI || k < -NAJVISE_RANIJE) continue;
    if (Math.abs(k) < najmanje) {
      najmanje = Math.abs(k);
      najbolji = p;
    }
  }
  return najbolji;
}

/** Kasnjenje u minutama (negativno = ranije) prema odabranom polasku. */
export function kasnjenje(polazak: number, minuteDoTocke: number, sad: number): number {
  return razlika(sad, polazak + minuteDoTocke);
}

/** Prvi polazak od sad nadalje (najviše 3 h unaprijed). */
export function sljedeciPolazak(polasci: number[], sad: number): { vrijeme: string; za: number } | null {
  let za = Infinity;
  let p = 0;
  for (const x of polasci) {
    const r = (((x - Math.floor(sad)) % 1440) + 1440) % 1440;
    if (r < za) {
      za = r;
      p = x;
    }
  }
  return za <= 180 ? { vrijeme: uSate(p), za } : null;
}
