import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LineDutyCardComponent } from './line-duty-card.component';

describe('LineDutyCardComponent', () => {
  let component: LineDutyCardComponent;
  let fixture: ComponentFixture<LineDutyCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LineDutyCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LineDutyCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
