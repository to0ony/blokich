import { TestBed } from '@angular/core/testing';

import { DriverScheduleService } from './driver-schedule.service';

describe('RasporedVoznjeService', () => {
  let service: DriverScheduleService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DriverScheduleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
