import { Injectable } from '@angular/core';
import { ApiService } from './api.service'; // prilagodi putanju ako treba

@Injectable({
  providedIn: 'root',
})
export class UploadService {
  constructor(private api: ApiService) {}

  uploadSluzbaPdf(pdf: File) {
    const formData = new FormData();
    formData.append('pdf', pdf);
    return this.api.post('sluzba-upload/upload', formData);
  }

  fetchLastSluzbaUpload() {
    return this.api.get('sluzba-upload/last-upload');
  }

  uploadDisponentPdf(pdf: File) {
    const formData = new FormData();
    formData.append('pdf', pdf);
    return this.api.post('disponent-upload/upload', formData);
  }

  fetchLastDisponentUpload() {
    return this.api.get('disponent-upload/last-upload');
  }

  uploadGodisnjiPdf(pdf: File) {
    const formData = new FormData();
    formData.append('pdf', pdf);
    return this.api.post('godisnji-upload/upload', formData);
  }

  fetchLastGodisnjiUpload() {
    return this.api.get('godisnji-upload/last-upload');
  }

  syncZetPodsused() {
    return this.api.post<ZetSyncOdgovor>('zet-sync/podsused', {});
  }

  uploadPdf(tip: UploadTip, pdf: File) {
    const formData = new FormData();
    formData.append('pdf', pdf);
    return this.api.post<UploadOdgovor>(`${tip}-upload/upload`, formData);
  }

  fetchLastUpload<T = any>(tip: UploadTip) {
    return this.api.get<T>(`${tip}-upload/last-upload`);
  }
}

export type UploadTip = 'sluzba' | 'disponent' | 'godisnji';

export type UploadStatus = 'obradjeno' | 'nema_promjene' | 'greska';

export interface UploadOdgovor {
  poruka: string;
  status?: UploadStatus;
}

export interface ZadnjiSluzbaUpload {
  datum_unosa: string;
  broj_ubacenih: number;
  original_filename?: string;
  verzija?: string;
  izvor?: 'rucno' | 'zet';
}

export interface ZadnjiDisponentUpload {
  datum_unosa: string;
  brojTjedna: number;
  godina: number;
}

export interface ZadnjiGodisnjiUpload {
  createdAt: string;
  brojVozaca: number;
}

export interface ZetSyncStavka {
  dokument: 'sluzba' | 'disponent';
  status: UploadStatus;
  poruka: string;
  filename?: string;
  url?: string;
}

export interface ZetSyncOdgovor {
  stavke: ZetSyncStavka[];
}
