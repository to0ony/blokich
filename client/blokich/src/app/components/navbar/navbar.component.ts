import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent {
  @Input() role: 'vozac' | 'admin' = 'vozac';

  @Input() view!: 'raspored' | 'vozaci' | 'smjena';
  @Output() switchView = new EventEmitter<'raspored' | 'vozaci' | 'smjena'>();
  isDrivingToday: boolean = false;

  ngOnInit(): void {
    const adminToken = localStorage.getItem('token');
    this.role = adminToken ? 'admin' : 'vozac';

    setInterval(() => {
      const linije = JSON.parse(
        sessionStorage.getItem('danasnjeLinije') || '[]',
      );
      this.isDrivingToday = Array.isArray(linije) && linije.length > 0;
    }, 50);
  }

  imePrezime: string | null = sessionStorage.getItem('imePrezime');
  sluzbeniBroj: string | null = sessionStorage.getItem('sluzbeniBroj');

  constructor(private router: Router) {}

  logout(): void {
    sessionStorage.clear();
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
