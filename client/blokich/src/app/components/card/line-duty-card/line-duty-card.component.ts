import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-line-duty-card',
  templateUrl: './line-duty-card.component.html',
  styleUrls: ['./line-duty-card.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class LineDutyCardComponent implements OnInit {
  @Input() vozac!: {
    sluz_broj: string;
    ime_prezime: string;
    od: string;
    do: string;
    nastup: string;
    zavrsetak: string;
    br_sl: string;
    linija: string;
    'V.R'?: string;
  };

  prijavljeniBroj: string | null = null;
  jePrijavljeni: boolean = false;

  ngOnInit(): void {
    this.prijavljeniBroj = sessionStorage.getItem('sluzbeniBroj');
    this.jePrijavljeni = this.vozac.sluz_broj === this.prijavljeniBroj;
  }
}
