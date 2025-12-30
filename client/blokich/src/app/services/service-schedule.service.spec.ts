import { TestBed } from '@angular/core/testing';

import { ServiceScheduleService } from './service-schedule.service';

describe('ServiceScheduleService', () => {
  let service: ServiceScheduleService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ServiceScheduleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
