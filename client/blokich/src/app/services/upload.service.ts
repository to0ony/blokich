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

  provjeriZetPodsused() {
    return this.api.post<ZetSyncOdgovor>('zet-sync/podsused/provjera', {});
  }

  uveziZetPodsused(potvrda: ZetUvozPotvrda) {
    return this.api.post<ZetSyncOdgovor>('zet-sync/podsused/uvoz', potvrda);
  }

  /** prepisi: isti PDF se ipak ponovno unosi i prepisuje postojeći uvoz. */
  uploadPdf(
    tip: UploadTip,
    pdf: File,
    izvorniSha256?: string,
    prepisi = false,
  ) {
    const formData = new FormData();
    formData.append('pdf', pdf);
    if (izvorniSha256) formData.append('izvorni_sha256', izvorniSha256);
    if (prepisi) formData.append('prepisi', 'true');
    return this.api.post<UploadOdgovor>(`${tip}-upload/upload`, formData);
  }

  fetchRucniUvozi() {
    return this.api.get<RucniUvoz[]>('rucni-uvoz');
  }

  fetchPovijestDisponenta() {
    return this.api.get<PovijestDisponenta[]>('disponent-upload/povijest');
  }

  fetchPovijestSluzbi() {
    return this.api.get<PovijestSluzbi[]>('sluzba-upload/povijest');
  }

  /** Službe koje vrijede za tekući ili naredni tjedan (login ekran). */
  fetchAktualneSluzbe(tjedan: 'tekuci' | 'naredni' = 'tekuci') {
    return this.api.get<AktualneSluzbe>(
      `sluzba-upload/aktualna?tjedan=${tjedan}`,
    );
  }

  fetchSluzbeVerzije(verzija: string) {
    return this.api.get<SluzbeVerzije>(
      `sluzba-upload/verzija/${encodeURIComponent(verzija)}`,
    );
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
  sha256?: string;
  izvor?: 'rucno' | 'zet';
}

export interface ZadnjiDisponentUpload {
  datum_unosa: string;
  brojTjedna: number;
  godina: number;
  verzija_sluzbe?: string | null;
}

export interface ZadnjiGodisnjiUpload {
  createdAt: string;
  brojVozaca: number;
}

export interface ZetSyncStavka {
  dokument: ZetDokument;
  status: UploadStatus | 'novo';
  poruka: string;
  filename?: string;
  url?: string;
  sha256?: string;
}

export type ZetDokument = 'sluzba' | 'disponent';

export type ZetUvozPotvrda = Partial<Record<ZetDokument, string>>;

export interface RucniUvoz {
  dokument: ZetDokument;
  oznaka: string;
  datum_unosa: string;
  original_filename?: string;
  izvorni_sha256?: string;
}

interface PovijestUvoza {
  datum_unosa: string;
  original_filename?: string;
  sha256?: string;
  izvorni_sha256?: string;
  izvor?: 'rucno' | 'zet';
}

export interface PovijestDisponenta extends PovijestUvoza {
  godina: number;
  brojTjedna: number;
  broj_vozaca: number;
  verzija_sluzbe?: string | null;
}

export interface PovijestSluzbi extends PovijestUvoza {
  verzija?: string;
  broj_ubacenih: number;
  /** Tjedni čiji disponent koristi ovu verziju, najnoviji prvi. */
  tjedni?: { godina: number; brojTjedna: number }[];
}

/** Jedan dio službe kako je spremljen u bazi ("79" i "79P"). */
export interface SluzbaZapis {
  br_sl: string;
  linija?: string | null;
  varijanta?: string | null;
  nastup_sluzbe?: string | null;
  od?: string | null;
  do?: string | null;
  zavrsna_sluzba?: string | null;
  nocni_rad?: string | null;
  druga_smjena?: string | null;
  efektivni_sati?: string | null;
  ukupni_sati?: string | null;
  /** Samo verzije uvezene novim parserom. */
  dani?: ('RADNI_DAN' | 'SUBOTA' | 'NEDJELJA')[];
  vazi_od?: string | null;
  vazi_do?: string | null;
  sekcija?: string | null;
  vrsta?: 'jednodijelna' | 's_pauzom' | 'dvokratna';
}

export interface AktualneSluzbe {
  verzija: string;
  tjedan: { godina: number; brojTjedna: number };
  /** false: za taj tjedan nema disponenta, prikazana je zadnja verzija. */
  prema_disponentu: boolean;
  uvoz: {
    datum_unosa: string;
    original_filename?: string;
    broj_ubacenih: number;
  } | null;
  sluzbe: SluzbaZapis[];
}

export interface SluzbeVerzije {
  verzija: string;
  uvoz: PovijestSluzbi | null;
  sluzbe: SluzbaZapis[];
}

export interface ZetSyncOdgovor {
  stavke: ZetSyncStavka[];
}
