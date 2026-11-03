import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  UploadService,
  UploadStatus,
} from '../../../services/upload.service';

@Component({
  selector: 'app-upload-sluzba',
  standalone: true,
  templateUrl: './upload-sluzba.component.html',
  styleUrls: ['./upload-sluzba.component.scss'],
  imports: [CommonModule],
})
export class UploadSluzbaComponent implements OnInit {
  selectedFile: File | null = null;
  uploadStatus: string = '';
  statusTip: UploadStatus | '' = '';
  lastUploadInfo: any = null;

  loading = false;

  constructor(private uploadService: UploadService) {}

  ngOnInit(): void {
    this.fetchLastUpload();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input?.files?.[0] ?? null;
  }

  upload(): void {
    if (!this.selectedFile) {
      this.uploadStatus = 'Molimo odaberite PDF datoteku.';
      return;
    }

    this.loading = true;
    this.uploadStatus = '';
    this.statusTip = '';

    this.uploadService.uploadSluzbaPdf(this.selectedFile).subscribe({
      next: (res: any) => {
        this.uploadStatus = res.poruka || 'Uspješan upload!';
        this.statusTip = res.status || 'obradjeno';
        this.fetchLastUpload();
        this.loading = false;
      },
      error: () => {
        this.uploadStatus = 'Došlo je do greške prilikom uploada.';
        this.statusTip = 'greska';
        this.loading = false;
      },
    });
  }

  fetchLastUpload(): void {
    this.uploadService.fetchLastSluzbaUpload().subscribe({
      next: (data) => (this.lastUploadInfo = data),
      error: () => (this.lastUploadInfo = null),
    });
  }
}
