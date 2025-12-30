import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServiceDutyCardComponent } from './service-duty-card.component';

describe('ServiceDutyCardComponent', () => {
  let component: ServiceDutyCardComponent;
  let fixture: ComponentFixture<ServiceDutyCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServiceDutyCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ServiceDutyCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
