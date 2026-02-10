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
  @Input() duties: any[] = [];

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
