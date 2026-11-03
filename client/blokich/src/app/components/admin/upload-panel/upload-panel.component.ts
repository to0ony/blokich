import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UploadDisponentComponent } from '../upload-disponent/upload-disponent.component';
import { UploadSluzbaComponent } from '../upload-sluzba/upload-sluzba.component';
import { UploadGodisnjiComponent } from '../upload-godisnji/upload-godisnji.component';
import {
  UploadService,
  ZetSyncStavka,
} from '../../../services/upload.service';

@Component({
  selector: 'app-upload-panel',
  standalone: true,
  imports: [
    CommonModule,
    UploadDisponentComponent,
    UploadSluzbaComponent,
    UploadGodisnjiComponent,
  ],
  templateUrl: './upload-panel.component.html',
  styleUrl: './upload-panel.component.scss',
})
export class UploadPanelComponent {
  @ViewChild(UploadSluzbaComponent) sluzbaCmp?: UploadSluzbaComponent;
  @ViewChild(UploadDisponentComponent) disponentCmp?: UploadDisponentComponent;

  zetLoading = false;
  zetStavke: ZetSyncStavka[] = [];
  zetGreska = '';

  readonly naziviDokumenata: Record<ZetSyncStavka['dokument'], string> = {
    sluzba: 'Službe',
    disponent: 'Disponent',
  };

  constructor(private uploadService: UploadService) {}

  syncZetPodsused(): void {
    this.zetLoading = true;
    this.zetStavke = [];
    this.zetGreska = '';

    this.uploadService.syncZetPodsused().subscribe({
      next: (res) => {
        this.zetStavke = res.stavke;
        this.zetLoading = false;
        this.sluzbaCmp?.fetchLastUpload();
        this.disponentCmp?.fetchLastUpload();
      },
      error: (err) => {
        this.zetGreska =
          err?.error?.message || 'Povlačenje podataka sa ZET-a nije uspjelo.';
        this.zetLoading = false;
      },
    });
  }
}
