import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import {
  PovijestSluzbi,
  SluzbaZapis,
  UploadService,
} from '../../../services/upload.service';
import { SluzbePopisComponent } from '../../sluzbe-popis/sluzbe-popis.component';

/** Admin: dijalog sa svim službama jedne verzije iz povijesti. */
@Component({
  selector: 'app-sluzbe-pregled',
  standalone: true,
  imports: [CommonModule, DialogModule, SkeletonModule, SluzbePopisComponent],
  templateUrl: './sluzbe-pregled.component.html',
  styleUrl: './sluzbe-pregled.component.scss',
})
export class SluzbePregledComponent implements OnChanges {
  /** Verzija za prikaz; null zatvara dijalog. */
  @Input() verzija: string | null = null;
  /** Podaci iz povijesti (tjedni), da se ne dohvaćaju ponovno. */
  @Input() povijest: PovijestSluzbi | null = null;
  @Output() zatvoreno = new EventEmitter<void>();

  vidljivo = false;
  ucitava = false;
  greska = '';
  zapisi: SluzbaZapis[] = [];

  constructor(private uploadService: UploadService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['verzija']) {
      this.vidljivo = !!this.verzija;
      if (this.verzija) this.ucitaj(this.verzija);
    }
  }

  private ucitaj(verzija: string): void {
    this.ucitava = true;
    this.greska = '';
    this.zapisi = [];
    this.uploadService.fetchSluzbeVerzije(verzija).subscribe({
      next: (res) => {
        this.zapisi = res.sluzbe;
        this.ucitava = false;
      },
      error: (err) => {
        this.greska = err?.error?.message || 'Službe nisu dohvaćene.';
        this.ucitava = false;
      },
    });
  }

  zatvori(): void {
    this.vidljivo = false;
    this.zatvoreno.emit();
  }
}
