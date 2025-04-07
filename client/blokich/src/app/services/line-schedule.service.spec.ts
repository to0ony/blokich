import { TestBed } from '@angular/core/testing';

import { LineScheduleService } from './line-schedule.service';

describe('VozaciPoLinijiService', () => {
  let service: LineScheduleService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LineScheduleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
