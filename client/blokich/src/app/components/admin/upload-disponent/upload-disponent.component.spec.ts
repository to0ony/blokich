import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadDisponentComponent } from './upload-disponent.component';

describe('UploadDisponentComponent', () => {
  let component: UploadDisponentComponent;
  let fixture: ComponentFixture<UploadDisponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadDisponentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UploadDisponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
