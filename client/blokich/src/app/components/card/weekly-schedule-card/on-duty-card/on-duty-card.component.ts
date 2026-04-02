import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { BootstrapPopoverDirective } from '../../../../shared/bootstrap-popover.directive';
import { LucideAngularModule, ClockIcon } from 'lucide-angular';
import { LineScheduleService } from '../../../../services/line-schedule.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-on-duty-card',
  standalone: true,
  templateUrl: './on-duty-card.component.html',
  styleUrls: ['./on-duty-card.component.scss'],
  imports: [CommonModule, BootstrapPopoverDirective, LucideAngularModule],
})
export class OnDutyCardComponent {
  readonly ClockIcon = ClockIcon;

  @Input() dan!: string;
  @Input() datum!: string;
  @Input() duties: any[] = [];
  @Input() danSkraceno!: string;
  @Input() tjedan: 'trenutni' | 'naredni' = 'trenutni';

  isModalVisible = false;
  voznje: any[] = [];
  isLoading = false;
  ulogiraniSluzbeniBroj: string | null = null;

  constructor(private lineScheduleService: LineScheduleService) {
    this.ulogiraniSluzbeniBroj = sessionStorage.getItem('sluzbeniBroj')
  }

  // Provjera se koristi kod malih modala za prikaz smjena kod dana
  isUlogiran(vozacSluzBroj: any): boolean {
    if (!this.ulogiraniSluzbeniBroj || !vozacSluzBroj) return false;
    // Osiguravamo usporedbu kao string u slučaju da je jedan tip broj
    return String(vozacSluzBroj) === String(this.ulogiraniSluzbeniBroj);
  }

  isToday(): boolean {
    const [day, month, year] = this.datum.split('.');
    const today = new Date();
    const componentDate = new Date(+year, +month - 1, +day);

    return (
      componentDate.getDate() === today.getDate() &&
      componentDate.getMonth() === today.getMonth() &&
      componentDate.getFullYear() === today.getFullYear()
    );
  }

  getDayClass(): string {
    switch (this.dan.toLowerCase()) {
      case 'subota':
        return 'subota';
      case 'nedjelja':
        return 'nedjelja';
      default:
        return 'radni-dan';
    }
  }

openShiftModal(): void {
  this.isModalVisible = true;
  this.isLoading = true;
  this.voznje = [];

  // 1. Izvuci samo jedinstvene linije (koje nisu null/undefined)
  const jedinstveneLinije = [...new Set(
    this.duties
      .map(duty => duty.linija)
      .filter(linija => !!linija)
  )];

  // 2. Kreiraj zahtjeve samo za te jedinstvene linije
  const zahtjevi = jedinstveneLinije.map((linija) =>
    this.lineScheduleService.fetchLineDrivers(
      linija,
      this.danSkraceno,
      this.tjedan
    )
  );

  if (zahtjevi.length === 0) {
    this.isLoading = false;
    return;
  }

  // 3. Izvrši zahtjeve
  Promise.all(zahtjevi.map((req) => firstValueFrom(req)))
    .then((rezultati) => {
      // Mapiramo rezultate i koristimo flatMap da spojimo sve 'voze' nizove u jedan
      this.voznje = rezultati.flatMap((res) => res.voze || []);
      this.isLoading = false;
    })
    .catch((err) => {
      console.error('Greška pri dohvaćanju vozača:', err);
      this.voznje = [];
      this.isLoading = false;
    });
}

  closeShiftModal(): void {
    this.isModalVisible = false;
  }
}
