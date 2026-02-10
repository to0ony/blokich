import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent implements OnInit {
  @Input() role: 'vozac' | 'admin' = 'vozac';
  @Input() view!: 'raspored' | 'vozaci' | 'smjena' | 'sluzba';
  @Output() switchView = new EventEmitter<
    'raspored' | 'vozaci' | 'smjena' | 'sluzba'
  >();

  imePrezime: string | null = sessionStorage.getItem('imePrezime');
  sluzbeniBroj: string | null = sessionStorage.getItem('sluzbeniBroj');
  kontaktBroj: string | null = sessionStorage.getItem('kontaktBroj');
  kontaktBrojInfo: string = sessionStorage.getItem('kontaktBrojInfo') || '';

  isMenuOpen: boolean = false;

  constructor(private router: Router) {}

  get isDrivingToday(): boolean {
    try {
      const linijeStr = sessionStorage.getItem('danasnjeLinije');
      if (!linijeStr) return false;
      const linije = JSON.parse(linijeStr);
      return Array.isArray(linije) && linije.length > 0;
    } catch (e) {
      return false;
    }
  }

  ngOnInit(): void {
    const adminToken = localStorage.getItem('token');
    this.role = adminToken ? 'admin' : 'vozac';
  }

  onViewChange(newView: 'raspored' | 'vozaci' | 'smjena' | 'sluzba'): void {
    if (this.view !== newView) {
      this.switchView.emit(newView);
    }
    this.isMenuOpen = false;
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  logout(): void {
    sessionStorage.clear();
    // Umjesto potpunog brisanja, uklanjamo samo auth podatke kako bi sacuvali recentDriverNumbers
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }
}
