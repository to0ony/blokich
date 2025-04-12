import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Info } from 'lucide-angular';

@Component({
  selector: 'app-disponent-status',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './disponent-status.component.html',
  styleUrls: ['./disponent-status.component.scss'],
})
export class DisponentStatusComponent {
  @Input() show: boolean = false;

  readonly Info = Info;
}
