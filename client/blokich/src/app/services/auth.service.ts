import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private http: HttpClient) {}

  loginWithEmployeeNumber(sluzbeniBroj: string): Observable<any> {
    return this.http.post('api/auth/login', { sluzbeniBroj });
  }

  loginAsAdmin(username: string, password: string): Observable<any> {
    return this.http.post('api/auth/admin-login', { username, password });
  }
}
