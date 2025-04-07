import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OffDutyCardComponent } from './off-duty-card.component';

describe('OffDutyComponent', () => {
  let component: OffDutyCardComponent;
  let fixture: ComponentFixture<OffDutyCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OffDutyCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(OffDutyCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
