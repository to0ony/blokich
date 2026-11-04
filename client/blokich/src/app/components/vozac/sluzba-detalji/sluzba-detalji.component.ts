import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sluzba, rutaUrl } from '../vozac.model';

/** Detalji službi jednog dana: vrijeme, mjesta, sati i karta linije. */
@Component({
  selector: 'app-sluzba-detalji',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sluzba-detalji.component.html',
  styleUrl: './sluzba-detalji.component.scss',
})
export class SluzbaDetaljiComponent {
  @Input() sluzbe: Sluzba[] = [];

  readonly rutaUrl = rutaUrl;
}
