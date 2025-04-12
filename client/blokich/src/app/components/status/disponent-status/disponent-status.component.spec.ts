import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DisponentStatusComponent } from './disponent-status.component';

describe('DisponentStatusComponent', () => {
  let component: DisponentStatusComponent;
  let fixture: ComponentFixture<DisponentStatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisponentStatusComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DisponentStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
