import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly baseUrl = environment.apiUrl;
  private readonly openHolidaysApiUrl = environment.openHolidaysApi;

  constructor(private http: HttpClient) {}

  get<T>(endpoint: string, params?: HttpParams) {
    return this.http.get<T>(`${this.baseUrl}/${endpoint}`, { params });
  }

  getFromOpenHolidays<T>(endpoint: string, params?: HttpParams) {
    return this.http.get<T>(`${this.openHolidaysApiUrl}/${endpoint}`, {
      params,
    });
  }

  post<T>(endpoint: string, body: any, headers?: HttpHeaders) {
    return this.http.post<T>(`${this.baseUrl}/${endpoint}`, body, { headers });
  }

  put<T>(endpoint: string, body: any, headers?: HttpHeaders) {
    return this.http.put<T>(`${this.baseUrl}/${endpoint}`, body, { headers });
  }

  delete<T>(endpoint: string, headers?: HttpHeaders) {
    return this.http.delete<T>(`${this.baseUrl}/${endpoint}`, { headers });
  }
}
