import {
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';

/** Koliko treba povući (px, nakon prigušenja) da se osvježi. */
const PRAG = 64;
const MAKS = 96;
/** Indikator se vrti barem toliko, da brzo osvježavanje ne samo bljesne. */
const MIN_VRTNJA_MS = 500;

/**
 * Povuci-za-osvježavanje kao u aplikaciji: na vrhu stranice povlačenje prstom
 * prema dolje pa otpuštanje emitira (povuci). Dok je [osvjezava] true indikator
 * se vrti. Preglednikov vlastiti je isključen (overscroll-behavior u styles.scss).
 *
 * Ne reagira na kartu (MapLibre) ni na elemente s atributom data-bez-povlacenja.
 */
@Directive({
  selector: '[appPovuciOsvjezi]',
  standalone: true,
})
export class PovuciOsvjeziDirective implements OnInit, OnChanges, OnDestroy {
  @Input() osvjezava = false;
  @Output() povuci = new EventEmitter<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);
  private readonly ind = document.createElement('div');

  private startY = 0;
  private startX = 0;
  private pomak = 0;
  /** null = još nije odlučeno je li pokret okomit; false = vodoravan, ignoriraj. */
  private aktivno: boolean | null = null;
  private prati = false;
  private vrtiOd = 0;

  ngOnInit(): void {
    this.ind.className = 'po-osvjezi';
    this.ind.setAttribute('aria-hidden', 'true');
    this.ind.innerHTML = '<i class="pi pi-refresh"></i>';
    document.body.appendChild(this.ind);

    this.zone.runOutsideAngular(() => {
      this.host.addEventListener('touchstart', this.naStart, { passive: true });
      this.host.addEventListener('touchmove', this.naPomak, { passive: true });
      this.host.addEventListener('touchend', this.naKraj, { passive: true });
      this.host.addEventListener('touchcancel', this.naKraj, { passive: true });
    });
  }

  ngOnChanges(): void {
    if (this.osvjezava) return;
    // Gotovo: indikator ostaje dok ne prođe minimalna vrtnja, pa se skriva.
    if (this.ind.classList.contains('is-vrti')) {
      const ostalo = Math.max(0, MIN_VRTNJA_MS - (Date.now() - this.vrtiOd));
      setTimeout(() => this.postavi(0, false), ostalo);
    }
  }

  ngOnDestroy(): void {
    this.host.removeEventListener('touchstart', this.naStart);
    this.host.removeEventListener('touchmove', this.naPomak);
    this.host.removeEventListener('touchend', this.naKraj);
    this.host.removeEventListener('touchcancel', this.naKraj);
    this.ind.remove();
  }

  private readonly naStart = (e: TouchEvent): void => {
    this.prati = false;
    if (this.osvjezava || e.touches.length !== 1 || window.scrollY > 0) return;
    const cilj = e.target as Element | null;
    if (cilj?.closest('.maplibregl-map, [data-bez-povlacenja], .p-overlay, .p-menu')) return;
    this.startY = e.touches[0].clientY;
    this.startX = e.touches[0].clientX;
    this.pomak = 0;
    this.aktivno = null;
    this.prati = true;
  };

  private readonly naPomak = (e: TouchEvent): void => {
    if (!this.prati) return;
    const dy = e.touches[0].clientY - this.startY;
    const dx = e.touches[0].clientX - this.startX;
    if (this.aktivno === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      // Vodoravno listanje (kartice, tjedni) ili povlačenje prema gore – nije osvježavanje.
      this.aktivno = dy > 0 && Math.abs(dy) > Math.abs(dx) && window.scrollY <= 0;
      if (!this.aktivno) {
        this.prati = false;
        return;
      }
    }
    // Prigušeno, kao gumica: što dalje, to sporije.
    this.pomak = Math.min(MAKS, Math.max(0, dy) * 0.5);
    this.postavi(this.pomak, false);
  };

  private readonly naKraj = (): void => {
    if (!this.prati) return;
    this.prati = false;
    if (this.aktivno && this.pomak >= PRAG) {
      this.vrtiOd = Date.now();
      this.postavi(PRAG, true);
      try {
        navigator.vibrate?.(10);
      } catch {}
      this.zone.run(() => this.povuci.emit());
    } else {
      this.postavi(0, false);
    }
  };

  private postavi(pomak: number, vrti: boolean): void {
    const s = this.ind.style;
    this.ind.classList.toggle('is-vrti', vrti);
    this.ind.classList.toggle('is-vuce', pomak > 0 && !vrti && this.prati);
    this.ind.classList.toggle('is-spremno', pomak >= PRAG && !vrti);
    s.opacity = pomak > 0 ? String(Math.min(1, pomak / PRAG)) : '0';
    s.transform = `translate(-50%, ${pomak}px) rotate(${vrti ? 0 : pomak * 4}deg)`;
  }
}
