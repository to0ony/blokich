import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DriverShiftScheduleComponent } from './driver-shift-schedule.component';

describe('DriverShiftScheduleComponent', () => {
  let component: DriverShiftScheduleComponent;
  let fixture: ComponentFixture<DriverShiftScheduleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DriverShiftScheduleComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DriverShiftScheduleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
