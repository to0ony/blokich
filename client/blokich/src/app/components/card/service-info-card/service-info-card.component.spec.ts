import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServiceInfoCardComponent } from './service-info-card.component';

describe('ServiceInfoCardComponent', () => {
  let component: ServiceInfoCardComponent;
  let fixture: ComponentFixture<ServiceInfoCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServiceInfoCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ServiceInfoCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
