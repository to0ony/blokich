import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardDriverComponent } from './dashboard-driver.component';

describe('DashboardDriverComponent', () => {
  let component: DashboardDriverComponent;
  let fixture: ComponentFixture<DashboardDriverComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardDriverComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardDriverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
