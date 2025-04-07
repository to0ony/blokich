import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OnDutyCardComponent } from './on-duty-card.component';

describe('DutyCardComponent', () => {
  let component: OnDutyCardComponent;
  let fixture: ComponentFixture<OnDutyCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnDutyCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(OnDutyCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
