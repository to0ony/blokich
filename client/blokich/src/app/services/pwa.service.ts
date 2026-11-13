import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

/** Chromeov događaj za vlastiti gumb "Instaliraj" (nije u standardnim tipovima). */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Događaj zna stići prije nego se Angular podigne, pa se hvata čim se ova
 * datoteka učita (dio je početnog bundlea preko AppComponenta).
 */
let rano: InstallPromptEvent | null = null;
const naRanoPonudu = (e: Event) => {
  e.preventDefault();
  rano = e as InstallPromptEvent;
};
window.addEventListener('beforeinstallprompt', naRanoPonudu);

const KLJUC_ODBIJENO = 'blokich.instalacija.odbijeno';
/** Nakon "Ne sad" kartica za instalaciju se ne prikazuje mjesec dana. */
const ODBIJENO_MS = 30 * 24 * 60 * 60 * 1000;

function jeIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS se predstavlja kao Mac, ali ima dodir.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function jeInstalirano(): boolean {
  try {
    return (
      matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

function nedavnoOdbijeno(): boolean {
  try {
    const t = Number(localStorage.getItem(KLJUC_ODBIJENO));
    return !!t && Date.now() - t < ODBIJENO_MS;
  } catch {
    return false;
  }
}

/**
 * Ponašanje kao aplikacija na mobitelu: ponuda za instalaciju (Android gumb,
 * iOS upute), obavijest o novoj verziji (service worker) i stanje veze.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly sw = inject(SwUpdate);
  private ponuda: InstallPromptEvent | null = rano;

  /** Otvoreno kao instalirana aplikacija (s početnog zaslona). */
  readonly instalirano = signal(jeInstalirano());
  /** iOS nema gumb za instalaciju – prikazuju se upute (Podijeli → Dodaj na početni zaslon). */
  readonly ios = jeIos();
  /** Može li se ponuditi instalacija (Android/Chrome gumb ili iOS upute). */
  readonly mozeInstalirati = signal(!jeInstalirano() && !nedavnoOdbijeno() && (!!rano || jeIos()));
  /** Nova verzija je skinuta i čeka osvježavanje. */
  readonly novaVerzija = signal(false);
  readonly online = signal(navigator.onLine);

  constructor() {
    window.removeEventListener('beforeinstallprompt', naRanoPonudu);
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.ponuda = e as InstallPromptEvent;
      if (!this.instalirano() && !nedavnoOdbijeno()) this.mozeInstalirati.set(true);
    });
    window.addEventListener('appinstalled', () => {
      this.ponuda = null;
      this.mozeInstalirati.set(false);
    });
    try {
      matchMedia('(display-mode: standalone)').addEventListener('change', (e) =>
        this.instalirano.set(e.matches),
      );
    } catch {}

    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));

    if (this.sw.isEnabled) {
      this.sw.versionUpdates
        .pipe(filter((e) => e.type === 'VERSION_READY'))
        .subscribe(() => this.novaVerzija.set(true));
      // Pokvaren keš (npr. obrisane datoteke stare verzije) – samo svježe učitavanje pomaže.
      this.sw.unrecoverable.subscribe(() => location.reload());
      // Aplikacija na mobitelu dugo ostaje otvorena u pozadini: provjeri pri povratku.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.sw.checkForUpdate().catch(() => {});
      });
    }
  }

  /** Android/Chrome: sustavski dijalog za instalaciju. iOS nema – tamo se prikazuju upute. */
  get imaGumb(): boolean {
    return !!this.ponuda;
  }

  async instaliraj(): Promise<void> {
    const p = this.ponuda;
    if (!p) return;
    this.ponuda = null;
    // Ponuda se smije iskoristiti samo jednom; Chrome kasnije pošalje novu.
    this.mozeInstalirati.set(false);
    try {
      await p.prompt();
      await p.userChoice;
    } catch {}
  }

  odbij(): void {
    try {
      localStorage.setItem(KLJUC_ODBIJENO, String(Date.now()));
    } catch {}
    this.mozeInstalirati.set(false);
  }

  osvjezi(): void {
    if (!this.sw.isEnabled) return location.reload();
    this.sw
      .activateUpdate()
      .catch(() => {})
      .finally(() => location.reload());
  }
}
