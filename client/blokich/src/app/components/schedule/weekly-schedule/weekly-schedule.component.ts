import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  Output,
  EventEmitter,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OnDutyCardComponent } from '../../card/weekly-schedule-card/on-duty-card/on-duty-card.component';
import { OffDutyCardComponent } from '../../card/weekly-schedule-card/off-duty-card/off-duty-card.component';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { LucideAngularModule, ShareIcon } from 'lucide-angular';

dayjs.extend(isoWeek);

interface RasporedDan {
  dan: string;
  datum: string;
  duties: any[];
  isOff: boolean;
}

@Component({
  selector: 'app-weekly-schedule',
  standalone: true,
  imports: [
    CommonModule,
    OnDutyCardComponent,
    OffDutyCardComponent,
    LucideAngularModule,
  ],
  templateUrl: './weekly-schedule.component.html',
  styleUrls: ['./weekly-schedule.component.scss'],
})
export class WeeklyScheduleComponent
  implements OnInit, OnChanges, AfterViewInit
{
  readonly ShareIcon = ShareIcon;
  @Input() data!: any;
  @Input() naredniTjedanDostupan: boolean = true;
  @Output() tjedanPromjena = new EventEmitter<'trenutni' | 'naredni'>();
  @Input() tjedanAktivan: 'trenutni' | 'naredni' = 'trenutni';

  @Input() godina!: number;
  @Input() brojTjedna!: number;

  daniUTjednu = ['pon', 'uto', 'sri', 'cet', 'pet', 'sub', 'ned'];
  rasporedZaPrikaz: RasporedDan[] = [];
  prikazaniTjedan: number | null = null;
  prikazanaGodina: number | null = null;
  datum = dayjs().format('DD.MM.YYYY');

  ngOnInit() {
    this.dataDisplay();
  }

  ngAfterViewInit(): void {
    //   setTimeout(() => this.scrollToToday(), 0);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data']) {
      this.dataDisplay();
    }
  }

  changeWeek(tip: 'trenutni' | 'naredni') {
    if (this.tjedanAktivan !== tip) {
      this.tjedanPromjena.emit(tip);
    }
  }

  dataDisplay() {
    if (!this.data) return;

    const { raspored } = this.data;

    this.rasporedZaPrikaz = this.daniUTjednu.map((dan, index) => {
      const duties = raspored[dan] || [];
      const isOff = duties.length === 1 && duties[0].odsustvo;
      const datum = this.dateSetter(this.godina, this.brojTjedna, index);
      const nazivDana = this.dayNameFormatter(dan);

      return {
        dan: nazivDana,
        datum,
        duties,
        isOff,
      };
    });

    this.prikazaniTjedan = this.brojTjedna;
    this.prikazanaGodina = this.godina;
  }

  dayNameFormatter(kratica: string): string {
    const mapa = {
      pon: 'Ponedjeljak',
      uto: 'Utorak',
      sri: 'Srijeda',
      cet: 'Četvrtak',
      pet: 'Petak',
      sub: 'Subota',
      ned: 'Nedjelja',
    };
    return mapa[kratica as keyof typeof mapa] || kratica;
  }

  dateSetter(godina: number, tjedan: number, danIndex: number): string {
    return dayjs()
      .year(godina)
      .isoWeek(tjedan)
      .startOf('isoWeek')
      .add(danIndex, 'day')
      .format('DD.MM.YYYY');
  }

  isToday(datum: string): boolean {
    const [day, month, year] = datum.split('.');
    const today = new Date();
    const componentDate = new Date(+year, +month - 1, +day);

    return (
      componentDate.getDate() === today.getDate() &&
      componentDate.getMonth() === today.getMonth() &&
      componentDate.getFullYear() === today.getFullYear()
    );
  }

  // scrollToToday(): void {
  //   const el = document.getElementById('danasnja-kartica');
  //   if (el) {
  //     el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  //   }
  // }

  shareSchedule() {
    if (!this.rasporedZaPrikaz.length) return;

    const imePrezime = sessionStorage.getItem('imePrezime') || 'Vozač';
    // const sluzbeniBroj = sessionStorage.getItem('sluzbeniBroj') || '';

    let text = `📅 *RASPORED ${this.prikazaniTjedan}. TJEDAN ${this.prikazanaGodina}.*\n`;
    text += `👤 ${imePrezime}\n\n`;

    this.rasporedZaPrikaz.forEach((dan) => {
      // Format: PON 10.02.
      const danKratko = dan.dan.substring(0, 3).toUpperCase(); // PON
      const datumKratko = dan.datum.substring(0, 5); // 10.02

      text += `*${danKratko} ${datumKratko}.*\n`;

      if (dan.isOff) {
        // Prikazuje se npr: 🛌 SLOBODAN DAN (GO) ako ima oznaku, inace samo SLOBODAN DAN
        const oznaka = dan.duties[0]?.odsustvo
          ? `(${dan.duties[0]?.odsustvo})`
          : '';
        text += `🛌 SLOBODAN DAN ${oznaka}\n`;
      } else {
        dan.duties.forEach((d) => {
          // Format: 🔹 SL123/268: (DUBRAVA) 13:00 -> 15:00 (SAVSKI MOST)
          const oznakaSluzbe = d.linija
            ? `SL${d.br_sl}/${d.linija}`
            : `SL${d.br_sl}`;
          text += `🔹 ${oznakaSluzbe}: (${d.nastup_sluzbe}) ${d.od} -> ${d.do} (${d.zavrsna_sluzba})\n`;
        });
      }
      text += `\n`; // Prazan red između dana
    });

    text += `🔗 https://blokich.com`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }
}
