import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TemaService } from './theme/tema.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  // Tema se primjenjuje od prvog ekrana (prijava), ne tek u vozačkoj aplikaciji.
  private readonly tema = inject(TemaService);
}
