import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VozaciService } from '../../../services/vozaci.service';

declare var bootstrap: any;

interface VozacInfo {
  sluz_broj: string;
  ime_prezime: string;
}

@Component({
  standalone: true,
  selector: 'app-vozac-search-form',
  imports: [CommonModule, FormsModule],
  templateUrl: './vozac-search-form.component.html',
  styleUrls: ['./vozac-search-form.component.scss'],
})
export class VozacSearchFormComponent {
  searchQuery = '';
  searchResults: VozacInfo[] = [];

  constructor(private vozaciService: VozaciService) {}

  openSearch() {
    if (!this.searchQuery.trim()) return;

    this.vozaciService.searchVozaci(this.searchQuery).subscribe((res) => {
      this.searchResults = res;

      const modal = new bootstrap.Modal(document.getElementById('searchModal'));
      modal.show();
    });
  }
}
