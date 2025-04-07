import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadSluzbaComponent } from './upload-sluzba.component';

describe('UploadSluzbaComponent', () => {
  let component: UploadSluzbaComponent;
  let fixture: ComponentFixture<UploadSluzbaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadSluzbaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UploadSluzbaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
