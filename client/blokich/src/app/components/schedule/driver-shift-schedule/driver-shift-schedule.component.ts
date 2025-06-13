import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom, take } from 'rxjs';

import { LineScheduleService } from '../../../services/line-schedule.service';
import { OpenHolidaysService } from '../../../services/open-holidays.service';
import { LineDutyCardComponent } from '../../card/line-duty-card/line-duty-card.component';

@Component({
  selector: 'app-driver-shift-schedule',
  standalone: true,
  imports: [CommonModule, LineDutyCardComponent],
  templateUrl: './driver-shift-schedule.component.html',
  styleUrls: ['./driver-shift-schedule.component.scss'],
})
export class DriverShiftScheduleComponent implements OnInit {
  danasnjeLinije: string[] = [];
  danasnjiDan = '';
  voznje: any[] = [];

  isLoading = true;

  isHolidayToday = false;
  holidayName = '';

  constructor(
    private vozaciService: LineScheduleService,
    private holidaysService: OpenHolidaysService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.setDanasnjiDan();
    this.checkHolidayToday();

    const cached = sessionStorage.getItem('voznjeDanas');
    if (cached) {
      this.voznje = JSON.parse(cached);
      this.isLoading = false;
    } else {
      this.fetchScheduleData();
    }
  }

  private setDanasnjiDan(): void {
    const dani = ['ned', 'pon', 'uto', 'sri', 'cet', 'pet', 'sub'];
    this.danasnjiDan = dani[new Date().getDay()];
  }

  private checkHolidayToday(): void {
    const todayIso = new Date().toISOString().slice(0, 10); // yyyy-MM-dd
    const year = todayIso.slice(0, 4);

    this.holidaysService
      .getPublicHolidays(`${year}-01-01`, `${year}-12-31`)
      .pipe(take(1))
      .subscribe({
        next: (list) => {
          const hit = list.find((h) => h.startDate === todayIso);
          if (hit) {
            this.isHolidayToday = true;
            this.holidayName = hit.name[0]?.text ?? '';
          }
        },
        error: (err) => console.error('Holiday API error:', err),
      });
  }

  private fetchScheduleData(): void {
    const stored = sessionStorage.getItem('danasnjeLinije');
    this.danasnjeLinije = stored ? JSON.parse(stored) : [];

    if (this.danasnjeLinije.length === 0) {
      this.isLoading = false;
      return;
    }

    const zahtjevi = this.danasnjeLinije.map((linija) =>
      this.vozaciService.fetchLineDrivers(linija, this.danasnjiDan, 'trenutni'),
    );

    Promise.all(zahtjevi.map((req) => firstValueFrom(req)))
      .then((rezultati) => {
        this.voznje = rezultati.flatMap((res) => res.voze || []);
        sessionStorage.setItem('voznjeDanas', JSON.stringify(this.voznje));
        this.isLoading = false;
      })
      .catch((err) => {
        console.error('Greška pri dohvaćanju vozača za današnju smjenu:', err);
        this.voznje = [];
        this.isLoading = false;
      });
  }
}
