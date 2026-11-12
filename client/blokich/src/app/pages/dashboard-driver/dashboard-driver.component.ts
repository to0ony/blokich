import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PrimeNG } from 'primeng/config';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import dayjs from 'dayjs';
import { DriverScheduleService } from '../../services/driver-schedule.service';
import { postaviPrimeNgTemu } from '../../theme/primeng-setup';
import { RasporedComponent } from '../../components/vozac/raspored/raspored.component';
import { DanasComponent } from '../../components/vozac/danas/danas.component';
import { KalendarComponent } from '../../components/vozac/kalendar/kalendar.component';
import { LinijeComponent } from '../../components/vozac/linije/linije.component';
import { SluzbeComponent } from '../../components/vozac/sluzbe/sluzbe.component';
import { DriverStatsComponent } from '../../components/stats/driver-stats/driver-stats.component';
import {
  DANI,
  DanRasporeda,
  RasporedOdgovor,
  TjedanTip,
  VozacView,
  aktivniDan,
  inicijali,
  slozTjedan,
  telefoni,
} from '../../components/vozac/vozac.model';

interface NavStavka {
  view: VozacView;
  label: string;
  icon: string;
}

const VIEWS: VozacView[] = ['raspored', 'kalendar', 'danas', 'linije', 'sluzbe', 'statistika'];

@Component({
  selector: 'app-dashboard-driver',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    MenuModule,
    RasporedComponent,
    DanasComponent,
    KalendarComponent,
    LinijeComponent,
    SluzbeComponent,
    DriverStatsComponent,
  ],
  templateUrl: './dashboard-driver.component.html',
  styleUrls: ['./dashboard-driver.component.scss'],
})
export class DashboardDriverComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly rasporedService = inject(DriverScheduleService);

  readonly imePrezime = sessionStorage.getItem('imePrezime') || 'Vozač';
  readonly sluzbeniBroj = sessionStorage.getItem('sluzbeniBroj') || '';
  readonly telefoni = telefoni(
    sessionStorage.getItem('kontaktBroj'),
    sessionStorage.getItem('kontaktBrojInfo'),
  );

  readonly nav: NavStavka[] = [
    { view: 'raspored', label: 'Raspored', icon: 'pi pi-calendar' },
    { view: 'danas', label: 'Danas', icon: 'pi pi-clock' },
    { view: 'linije', label: 'Linije', icon: 'pi pi-directions' },
    { view: 'sluzbe', label: 'Službe', icon: 'pi pi-search' },
    { view: 'statistika', label: 'Statistika', icon: 'pi pi-chart-bar' },
  ];

  readonly menu: MenuItem[] = [
    { label: 'Odjava', icon: 'pi pi-sign-out', command: () => this.odjava() },
  ];

  view: VozacView = 'raspored';
  tjedan: TjedanTip = 'trenutni';
  naredniDostupan = false;

  /** Prikazani tjedan (trenutni ili naredni). */
  podaci: RasporedOdgovor | null = null;
  loading = true;
  error: string | null = null;

  /** Dani tekućeg tjedna – iz njih se bira aktivni dan za pogled "Danas". */
  private daniTekuci: DanRasporeda[] = [];
  danasLoading = true;
  /** Ponedjeljak nakon ponoći: nedjelja prošlog tjedna dok njena noćna služba traje. */
  prethodniDan: DanRasporeda | null = null;

  /** Današnji dan, a nakon ponoći jučerašnji dok njegova noćna služba traje. */
  get danas(): DanRasporeda | undefined {
    return aktivniDan(this.daniTekuci);
  }

  constructor() {
    postaviPrimeNgTemu(inject(PrimeNG));
  }

  get inicijali(): string {
    return inicijali(this.imePrezime);
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((q) => {
      const v = q.get('v') as VozacView | null;
      this.view = v && VIEWS.includes(v) ? v : 'raspored';
      window.scrollTo({ top: 0 });
    });

    this.rasporedService.fetchUpcomingWeekSchedule().subscribe({
      next: (d) => (this.naredniDostupan = !!d),
      error: () => (this.naredniDostupan = false),
    });

    this.ucitaj();
  }

  /** Kalendar se otvara iz Rasporeda, pa tab Raspored ostaje označen. */
  aktivan(v: VozacView): boolean {
    return this.view === v || (v === 'raspored' && this.view === 'kalendar');
  }

  promijeniView(v: VozacView): void {
    this.router.navigate([], {
      queryParams: { v: v === 'raspored' ? null : v },
      queryParamsHandling: 'merge',
    });
  }

  promijeniTjedan(t: TjedanTip): void {
    this.tjedan = t;
    this.ucitaj();
  }

  ucitaj(): void {
    this.loading = true;
    this.error = null;

    const zahtjev =
      this.tjedan === 'trenutni'
        ? this.rasporedService.fetchDriverSchedule()
        : this.rasporedService.fetchUpcomingWeekSchedule();

    zahtjev.subscribe({
      next: (data: RasporedOdgovor) => {
        this.podaci = data;
        this.loading = false;
        if (this.tjedan === 'trenutni') this.postaviDanas(data);
      },
      error: () => {
        this.podaci = null;
        this.loading = false;
        this.danasLoading = false;
        this.error = 'Raspored nije moguće učitati. Provjeri vezu i pokušaj ponovno.';
      },
    });
  }

  private postaviDanas(data: RasporedOdgovor): void {
    this.daniTekuci = slozTjedan(data);
    this.danasLoading = false;
    this.ucitajProsluNedjelju();
    // Stare komponente (navbar) čitaju današnje linije iz sessionStorage.
    const linije = [...new Set((this.danas?.sluzbe ?? []).map((s) => s.linija).filter(Boolean))];
    sessionStorage.setItem('danasnjeLinije', JSON.stringify(linije));
  }

  /**
   * U ponedjeljak je nedjeljna služba u prošlom tjednu – dohvati je iz
   * kalendara, da noćna vožnja ne nestane u ponoć.
   */
  private ucitajProsluNedjelju(): void {
    const sad = dayjs();
    if (sad.isoWeekday() !== 1 || this.prethodniDan) return;
    const nedjelja = sad.subtract(1, 'day').startOf('day');
    this.rasporedService.fetchKalendar(nedjelja.year(), nedjelja.month() + 1).subscribe({
      next: (k) => {
        const d = k?.dani?.find((x) => dayjs(x.datum).isSame(nedjelja, 'day'));
        const kandidat: DanRasporeda = {
          ...DANI[6],
          datum: nedjelja,
          sluzbe: d?.sluzbe ?? [],
          odsustvo: null,
          danas: false,
          prosao: true,
        };
        // Samo dok neki dio nedjeljne službe još nije odvožen.
        if (aktivniDan([kandidat]) === kandidat) this.prethodniDan = kandidat;
      },
      error: () => {},
    });
  }

  odjava(): void {
    // Pristupni token (lozinka) ostaje u localStorage – vozač je ne upisuje ponovno.
    sessionStorage.clear();
    this.router.navigate(['/login']);
  }
}
