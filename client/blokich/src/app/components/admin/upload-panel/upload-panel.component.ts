import { Component } from '@angular/core';
import { UploadDisponentComponent } from '../upload-disponent/upload-disponent.component';
import { UploadSluzbaComponent } from '../upload-sluzba/upload-sluzba.component';
import { UploadGodisnjiComponent } from '../upload-godisnji/upload-godisnji.component';

@Component({
  selector: 'app-upload-panel',
  standalone: true,
  imports: [
    UploadDisponentComponent,
    UploadSluzbaComponent,
    UploadGodisnjiComponent,
  ],
  templateUrl: './upload-panel.component.html',
  styleUrl: './upload-panel.component.scss',
})
export class UploadPanelComponent {}
