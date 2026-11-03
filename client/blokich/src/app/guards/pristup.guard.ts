import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PristupStorage } from '../services/pristup-storage';

/** Stranice dostupne bez prijave vozača, ali samo na otključanom uređaju. */
export const PristupGuard: CanActivateFn = () =>
  PristupStorage.otkljucano ? true : inject(Router).parseUrl('/login');
