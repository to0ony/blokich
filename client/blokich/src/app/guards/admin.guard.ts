import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AdminGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): boolean | UrlTree {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user?.isAdmin) {
      return true;
    }
    return this.router.parseUrl('/login');
  }
}
