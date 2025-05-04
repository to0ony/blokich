import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VozacSearchFormComponent } from './vozac-search-form.component';

describe('VozacSearchFormComponent', () => {
  let component: VozacSearchFormComponent;
  let fixture: ComponentFixture<VozacSearchFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VozacSearchFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VozacSearchFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
