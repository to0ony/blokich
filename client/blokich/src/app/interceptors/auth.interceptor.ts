import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { PristupStorage } from '../services/pristup-storage';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const headers: Record<string, string> = {};

  const adminToken = localStorage.getItem('token');
  if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;

  const pristupToken = PristupStorage.get();
  if (pristupToken) headers['X-Pristup-Token'] = pristupToken;

  return next(req.clone({ setHeaders: headers })).pipe(
    catchError((err: HttpErrorResponse) => {
      // Lozinka promijenjena ili token nevažeći → natrag na prijavu.
      // Login forma sama obrađuje svoju grešku.
      if (
        err.status === 401 &&
        err.error?.code === 'PRISTUP' &&
        !req.url.endsWith('/auth/login')
      ) {
        PristupStorage.clear();
        sessionStorage.removeItem('sluzbeniBroj');
        router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};
