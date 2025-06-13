import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { BootstrapPopoverDirective } from '../../../../shared/bootstrap-popover.directive';
import { LucideAngularModule, ClockIcon } from 'lucide-angular';
import { OpenHolidaysService } from '../../../../services/open-holidays.service';

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
  @Input() datum!: string;
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

  private sub?: Subscription;

  constructor(private holidays: OpenHolidaysService) {}

  ngOnInit(): void {
    const [year, month] = this.datum.split('-').map(Number);

    const firstDay = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDayDate = new Date(year, month, 0);
    const lastDay = `${year}-${month.toString().padStart(2, '0')}-${lastDayDate.getDate().toString().padStart(2, '0')}`;

    this.sub = this.holidays
      .getPublicHolidays(firstDay, lastDay)
      .subscribe((list) => {
        const found = list.find((h) => h.startDate === this.datum);
        if (found) {
          this.isHoliday = true;
          this.holidayName = found.name[0]?.text ?? '';
        }
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
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
