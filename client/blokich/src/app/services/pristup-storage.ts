/**
 * Pristupni token vozača. Sprema se u localStorage i ne briše se pri
 * odjavi, pa vozač lozinku upisuje samo jednom po uređaju.
 */
const KEY = 'pristupToken';

export const PristupStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(KEY, token);
    } catch {}
  },
  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {}
  },
  get otkljucano(): boolean {
    return !!this.get();
  },
};
