import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadGodisnjiComponent } from './upload-godisnji.component';

describe('UploadGodisnjiComponent', () => {
  let component: UploadGodisnjiComponent;
  let fixture: ComponentFixture<UploadGodisnjiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadGodisnjiComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UploadGodisnjiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
