import { Component } from '@angular/core';
import { PregledOkvirComponent } from '../../components/vozac/pregled-okvir/pregled-okvir.component';
import { SluzbeComponent } from '../../components/vozac/sluzbe/sluzbe.component';

/** Pregled službe s login ekrana – bez prijave službenim brojem. */
@Component({
  selector: 'app-pregled-sluzbe',
  standalone: true,
  imports: [PregledOkvirComponent, SluzbeComponent],
  template: `
    <app-pregled-okvir #okvir>
      <app-sluzbe [naredniDostupan]="okvir.naredniDostupan" />
    </app-pregled-okvir>
  `,
})
export class PregledSluzbeComponent {}
