import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const DriverGuard: CanActivateFn = (route, state) => {
  const serviceNumber = sessionStorage.getItem('sluzbeniBroj');

  if (!serviceNumber) {
    const router = inject(Router);
    router.navigate(['/login']);
    return false;
  }

  return true;
};
