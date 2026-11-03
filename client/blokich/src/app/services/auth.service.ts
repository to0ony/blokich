import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private api: ApiService) {}

  otkljucaj(lozinka: string): Observable<{ pristupToken: string | null }> {
    return this.api.post('auth/pristup', { lozinka });
  }

  loginWithEmployeeNumber(sluzbeniBroj: string): Observable<any> {
    return this.api.post('auth/login', { sluzbeniBroj });
  }

  loginAsAdmin(username: string, password: string): Observable<any> {
    return this.api.post('auth/admin-login', { username, password });
  }
}
