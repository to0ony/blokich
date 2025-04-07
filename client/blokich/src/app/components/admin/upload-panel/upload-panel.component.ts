import { Component } from '@angular/core';
import { UploadDisponentComponent } from '../upload-disponent/upload-disponent.component';
import { UploadSluzbaComponent } from '../upload-sluzba/upload-sluzba.component';

@Component({
  selector: 'app-upload-panel',
  standalone: true,
  imports: [UploadDisponentComponent, UploadSluzbaComponent],
  templateUrl: './upload-panel.component.html',
  styleUrl: './upload-panel.component.scss',
})
export class UploadPanelComponent {}
