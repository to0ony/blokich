import { Component } from '@angular/core';
import { PregledOkvirComponent } from '../../components/vozac/pregled-okvir/pregled-okvir.component';
import { LinijeComponent } from '../../components/vozac/linije/linije.component';

/** Vozači na liniji s login ekrana – bez prijave službenim brojem. */
@Component({
  selector: 'app-pregled-linije',
  standalone: true,
  imports: [PregledOkvirComponent, LinijeComponent],
  template: `
    <app-pregled-okvir #okvir>
      <app-linije [naredniDostupan]="okvir.naredniDostupan" />
    </app-pregled-okvir>
  `,
})
export class PregledLinijeComponent {}
