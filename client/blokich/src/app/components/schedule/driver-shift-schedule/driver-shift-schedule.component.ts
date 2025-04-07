import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LineScheduleService } from '../../../services/line-schedule.service';
import { LineDutyCardComponent } from '../../card/line-duty-card/line-duty-card.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-driver-shift-schedule',
  standalone: true,
  imports: [CommonModule, LineDutyCardComponent],
  templateUrl: './driver-shift-schedule.component.html',
  styleUrls: ['./driver-shift-schedule.component.scss'],
})
export class DriverShiftScheduleComponent implements OnInit {
  danasnjeLinije: string[] = [];
  danasnjiDan: string = '';
  voznje: any[] = [];
  isLoading = true;

  constructor(private vozaciService: LineScheduleService) {}

  ngOnInit(): void {
    const cached = sessionStorage.getItem('voznjeDanas');

    if (cached) {
      const dani = ['ned', 'pon', 'uto', 'sri', 'cet', 'pet', 'sub'];
      this.danasnjiDan = dani[new Date().getDay()];

      this.voznje = JSON.parse(cached);
      this.isLoading = false;
    } else {
      this.fetchScheduleData();
    }
  }

  private fetchScheduleData(): void {
    const dani = ['ned', 'pon', 'uto', 'sri', 'cet', 'pet', 'sub'];
    this.danasnjiDan = dani[new Date().getDay()];

    const stored = sessionStorage.getItem('danasnjeLinije');
    this.danasnjeLinije = stored ? JSON.parse(stored) : [];

    console.log(stored);

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
