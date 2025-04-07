import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LineScheduleComponent } from './line-schedule.component';

describe('LineScheduleComponent', () => {
  let component: LineScheduleComponent;
  let fixture: ComponentFixture<LineScheduleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LineScheduleComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LineScheduleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
