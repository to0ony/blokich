import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { BootstrapPopoverDirective } from '../../../../shared/bootstrap-popover.directive';
import { LucideAngularModule, ClockIcon } from 'lucide-angular';

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
}
