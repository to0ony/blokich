import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import {
  UploadOdgovor,
  UploadService,
  UploadStatus,
  UploadTip,
} from '../../../services/upload.service';

interface UploadOpis {
  naslov: string;
  opis: string;
  primjer: string;
}

const OPISI: Record<UploadTip, UploadOpis> = {
  sluzba: {
    naslov: 'Službe',
    opis: 'Raspored rada vozača s popisom svih službi. Ubaci ga prije disponenta.',
    primjer: 'APP - 2.11.2026.pdf',
  },
  disponent: {
    naslov: 'Disponent',
    opis: 'Tjedni raspored – na ZET-u objavljen kao „Službe od … do …“.',
    primjer: 'DisponentRaspored 02.11.-08.11.2026.pdf',
  },
  godisnji: {
    naslov: 'Godišnji odmori',
    opis: 'Plan godišnjih odmora vozača za tekuću godinu.',
    primjer: 'GO VOZAČA AUTOBUSA ZA 2026.GODINU.pdf',
  },
};

@Component({
  selector: 'app-manual-upload',
  standalone: true,
  imports: [CommonModule, ButtonModule, MessageModule],
  templateUrl: './manual-upload.component.html',
  styleUrl: './manual-upload.component.scss',
})
export class ManualUploadComponent {
  @Input({ required: true }) tip!: UploadTip;
  @Output() uploaded = new EventEmitter<UploadOdgovor>();

  file: File | null = null;
  dragOver = false;
  loading = false;
  poruka = '';
  status: UploadStatus | null = null;

  constructor(private uploadService: UploadService) {}

  get opis(): UploadOpis {
    return OPISI[this.tip];
  }

  get inputId(): string {
    return `pdf-${this.tip}`;
  }

  get severity(): 'success' | 'info' | 'error' {
    if (this.status === 'greska') return 'error';
    if (this.status === 'nema_promjene') return 'info';
    return 'success';
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setFile(input.files?.[0] ?? null);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    this.setFile(event.dataTransfer?.files?.[0] ?? null);
  }

  clear(): void {
    this.file = null;
    this.poruka = '';
    this.status = null;
  }

  /** Disponent i službe se mogu ponovno unijeti i kad je PDF isti. */
  get mozePrepisati(): boolean {
    return this.status === 'nema_promjene' && this.tip !== 'godisnji';
  }

  /** prepisi: isti PDF se ponovno parsira i prepisuje postojeći uvoz. */
  upload(prepisi = false): void {
    if (!this.file) return;

    this.loading = true;
    this.poruka = '';
    this.status = null;

    this.uploadService
      .uploadPdf(this.tip, this.file, undefined, prepisi)
      .subscribe({
        next: (res) => {
          this.status = res.status ?? 'obradjeno';
          this.poruka = res.poruka || 'PDF je uspješno obrađen.';
          this.loading = false;
          if (this.status === 'obradjeno') this.file = null;
          this.uploaded.emit(res);
        },
        error: (err) => {
          this.status = 'greska';
          this.poruka =
            err?.error?.message || 'Došlo je do greške prilikom obrade PDF-a.';
          this.loading = false;
        },
      });
  }

  formatSize(bytes: number): string {
    return bytes > 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
      : `${Math.round(bytes / 1024)} KB`;
  }

  private setFile(file: File | null): void {
    this.poruka = '';
    this.status = null;
    if (file && !/\.pdf$/i.test(file.name)) {
      this.file = null;
      this.status = 'greska';
      this.poruka = 'Dozvoljene su samo PDF datoteke.';
      return;
    }
    this.file = file;
  }
}
