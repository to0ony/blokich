import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LineDutyCardComponent } from '../../card/line-duty-card/line-duty-card.component';
import { LineScheduleService } from '../../../services/line-schedule.service';

@Component({
  selector: 'app-line-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule, LineDutyCardComponent],
  templateUrl: './line-schedule.component.html',
  styleUrls: ['./line-schedule.component.scss'],
})
export class LineScheduleComponent implements OnInit {
  odabranaLinija: string = '';
  odabraniDan: string = '';
  odabraniTjedan: 'trenutni' | 'naredni' = 'trenutni';
  voze: any[] = [];
  linija: string = '';
  dan: string = '';
  isSearched: boolean = false;
  isLoading: boolean = false;

  // Provjera dostupnosti iz session storagea koji je postavljen kod logina
  isNextWeekAvailable: boolean =
    sessionStorage.getItem('nextWeekDisponentAvailable') === 'true';

  dani = [
    { key: 'pon', label: 'Ponedjeljak' },
    { key: 'uto', label: 'Utorak' },
    { key: 'sri', label: 'Srijeda' },
    { key: 'cet', label: 'Četvrtak' },
    { key: 'pet', label: 'Petak' },
    { key: 'sub', label: 'Subota' },
    { key: 'ned', label: 'Nedjelja' },
  ];

  constructor(private vozaciService: LineScheduleService) {}

  ngOnInit(): void {
    // Ako naredni tjedan nije dostupan, osiguraj da je default uvijek trenutni
    if (!this.isNextWeekAvailable) {
      this.odabraniTjedan = 'trenutni';
    }
  }

  fetchScheduleData() {
    if (!this.odabranaLinija || !this.odabraniDan) return;

    this.isLoading = true;
    this.isSearched = true;

    this.vozaciService
      .fetchLineDrivers(
        this.odabranaLinija,
        this.odabraniDan,
        this.odabraniTjedan,
      )
      .subscribe({
        next: (data) => {
          this.linija = data.linija;
          this.dan = data.dan;
          this.voze = data.voze;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Greška pri dohvaćanju vozača:', err);
          this.voze = [];
          this.isLoading = false;
        },
      });
  }
}
