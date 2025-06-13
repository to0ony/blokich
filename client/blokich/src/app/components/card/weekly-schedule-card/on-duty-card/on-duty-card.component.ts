import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { BootstrapPopoverDirective } from '../../../../shared/bootstrap-popover.directive';
import { LucideAngularModule, ClockIcon } from 'lucide-angular';
import { OpenHolidaysService } from '../../../../services/open-holidays.service';

interface HolidayMap {
  [isoDate: string]: string;
}

@Component({
  selector: 'app-on-duty-card',
  standalone: true,
  templateUrl: './on-duty-card.component.html',
  styleUrls: ['./on-duty-card.component.scss'],
  imports: [CommonModule, BootstrapPopoverDirective, LucideAngularModule],
})
export class OnDutyCardComponent implements OnInit, OnDestroy {
  readonly ClockIcon = ClockIcon;

  @Input() dan!: string;
  @Input() datum!: string; // očekuje ISO format: yyyy-MM-dd
  @Input() vrijemePocetak!: string;
  @Input() vrijemeKraj!: string;
  @Input() nocniRad!: string;
  @Input() drSmj!: string;
  @Input() efekSati!: string;
  @Input() ukupSati!: string;
  @Input() brojSluzbe!: string;
  @Input() linija!: string;
  @Input() vr!: string;
  @Input() nastup!: string;
  @Input() zavrsetak!: string;
  @Input() oznaka?: string;

  isHoliday = false;
  holidayName = '';

  private static cache: HolidayMap = {};
  private sub?: Subscription;

  constructor(private holidays: OpenHolidaysService) {}

  ngOnInit(): void {
    if (OnDutyCardComponent.cache[this.datum] !== undefined) {
      this.setHoliday(this.datum);
    } else {
      const [year, month] = this.datum.split('-').map(Number);

      const firstDay = `${year}-${month.toString().padStart(2, '0')}-01`;

      const lastDayDate = new Date(year, month, 0);
      const lastDay = `${year}-${month.toString().padStart(2, '0')}-${lastDayDate.getDate().toString().padStart(2, '0')}`;

      this.sub = this.holidays
        .getPublicHolidays(firstDay, lastDay)
        .subscribe((list) => {
          list.forEach(
            (h) =>
              (OnDutyCardComponent.cache[h.startDate] = h.name[0]?.text ?? ''),
          );
          this.setHoliday(this.datum);
        });
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private setHoliday(date: string) {
    const name = OnDutyCardComponent.cache[date];
    if (name) {
      this.isHoliday = true;
      this.holidayName = name;
    }
  }

  getDayClass(): string {
    if (this.isHoliday) return 'neradni';
    switch (this.dan.toLowerCase()) {
      case 'subota':
        return 'subota';
      case 'nedjelja':
        return 'nedjelja';
      default:
        return 'radni-dan';
    }
  }
}
