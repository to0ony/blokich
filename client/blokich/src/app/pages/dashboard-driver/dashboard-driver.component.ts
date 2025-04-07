import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DriverScheduleService } from '../../services/driver-schedule.service';
import { WeeklyScheduleComponent } from '../../components/schedule/weekly-schedule/weekly-schedule.component';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { LineScheduleComponent } from '../../components/schedule/line-schedule/line-schedule.component';
import { LineScheduleService } from '../../services/line-schedule.service';
import { DriverShiftScheduleComponent } from '../../components/schedule/driver-shift-schedule/driver-shift-schedule.component';

@Component({
  selector: 'app-dashboard-driver',
  standalone: true,
  imports: [
    CommonModule,
    WeeklyScheduleComponent,
    NavbarComponent,
    LineScheduleComponent,
    DriverShiftScheduleComponent,
  ],
  templateUrl: './dashboard-driver.component.html',
  styleUrls: ['./dashboard-driver.component.scss'],
})
export class DashboardDriverComponent implements OnInit {
  rasporedData: any = null;
  loading = true;
  error: string | null = null;
  view: 'raspored' | 'vozaci' | 'smjena' = 'raspored';
  naredniTjedanDostupan: boolean = true;

  linijaParam: string | null = null;
  danParam: string | null = null;
  tjedanParam: 'trenutni' | 'naredni' = 'trenutni';
  vozaciPodaci: any = null;

  tjedanAktivan: 'trenutni' | 'naredni' = 'trenutni';

  godina: number | null = null;
  brojTjedna: number | null = null;

  danasnjeLinije: string[] = [];

  constructor(
    private rasporedService: DriverScheduleService,
    private vozaciService: LineScheduleService,
  ) {}

  ngOnInit(): void {
    this.dataAvailabilityForNextWeek();
    this.displayData('trenutni');
  }

  setView(
    view: 'raspored' | 'vozaci' | 'smjena',
    linija?: string,
    dan?: string,
    tjedan: 'trenutni' | 'naredni' = 'trenutni',
  ) {
    this.view = view;

    if (view === 'vozaci' && linija && dan) {
      this.linijaParam = linija;
      this.danParam = dan;
      this.tjedanParam = tjedan;

      this.vozaciService.fetchLineDrivers(linija, dan, tjedan).subscribe({
        next: (data) => (this.vozaciPodaci = data),
        error: (err) => {
          console.error('Greška pri dohvaćanju vozača po liniji', err);
          this.vozaciPodaci = null;
        },
      });
    }
  }

  onWeekChange(tip: 'trenutni' | 'naredni') {
    this.tjedanAktivan = tip;
    this.displayData(tip);
  }

  dataAvailabilityForNextWeek() {
    this.rasporedService.fetchUpcomingWeekSchedule().subscribe({
      next: () => {
        this.naredniTjedanDostupan = true;
      },
      error: () => {
        this.naredniTjedanDostupan = false;
      },
    });
  }

  private storePresentDriverLines(data: any) {
    const dani = ['ned', 'pon', 'uto', 'sri', 'cet', 'pet', 'sub'];
    const danasnjiDan = dani[new Date().getDay()];

    const danasnjiRaspored = data.raspored[danasnjiDan];

    if (Array.isArray(danasnjiRaspored)) {
      const linije = Array.from(
        new Set(
          danasnjiRaspored
            .filter((item) => item.linija)
            .map((item) => item.linija),
        ),
      );

      sessionStorage.setItem('danasnjeLinije', JSON.stringify(linije));
    } else {
      sessionStorage.setItem('danasnjeLinije', JSON.stringify([]));
    }
  }

  private displayData(tip: 'trenutni' | 'naredni') {
    this.loading = true;
    this.error = null;

    const zahtjev =
      tip === 'trenutni'
        ? this.rasporedService.fetchDriverSchedule()
        : this.rasporedService.fetchUpcomingWeekSchedule();

    zahtjev.subscribe({
      next: (data) => {
        this.rasporedData = data;
        this.godina = data.godina;
        this.brojTjedna = data.tjedan;
        this.loading = false;

        if (this.tjedanAktivan == 'trenutni') {
          this.storePresentDriverLines(data);
        }
      },
      error: (err) => {
        this.error = 'Greška pri dohvaćanju rasporeda.';
        console.error(err);
        this.loading = false;
      },
    });
  }
}
