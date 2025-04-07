import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-off-duty-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './off-duty-card.component.html',
  styleUrls: ['./off-duty-card.component.scss'],
})
export class OffDutyCardComponent {
  @Input() dan!: string;
  @Input() datum!: string;
  @Input() oznaka!: string;
}
