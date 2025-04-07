import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class UploadService {
  constructor(private http: HttpClient) {}

  uploadSluzbaPdf(pdf: File) {
    const formData = new FormData();
    formData.append('pdf', pdf);
    return this.http.post(`/api/sluzba-upload/upload`, formData);
  }

  fetchLastSluzbaUpload() {
    return this.http.get(`/api/sluzba-upload/last-upload`);
  }

  uploadDisponentPdf(pdf: File) {
    const formData = new FormData();
    formData.append('pdf', pdf);
    return this.http.post(`/api/disponent-upload/upload`, formData);
  }

  fetchLastDisponentUpload() {
    return this.http.get(`/api/disponent-upload/last-upload`);
  }
}
