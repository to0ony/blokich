import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UploadService } from '../../../services/upload.service';

@Component({
  selector: 'app-upload-godisnji',
  standalone: true,
  templateUrl: './upload-godisnji.component.html',
  styleUrl: './upload-godisnji.component.scss',
  imports: [CommonModule],
})
export class UploadGodisnjiComponent implements OnInit {
  selectedFile: File | null = null;
  uploadStatus: string = '';
  lastUploadInfo: any;

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

    this.uploadService.uploadGodisnjiPdf(this.selectedFile).subscribe({
      next: (res: any) => {
        this.uploadStatus = res.poruka || 'Uspješan upload!';
        this.fetchLastUpload();
        this.loading = false;
      },
      error: () => {
        this.uploadStatus = 'Došlo je do greške prilikom uploada.';
        this.loading = false;
      },
    });
  }

  fetchLastUpload(): void {
    this.uploadService.fetchLastGodisnjiUpload().subscribe({
      next: (data) => (this.lastUploadInfo = data),
      error: () => (this.lastUploadInfo = null),
    });
  }
}
