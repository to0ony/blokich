import { TestBed } from '@angular/core/testing';

import { VozaciService } from './vozaci.service';

describe('VozaciService', () => {
  let service: VozaciService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VozaciService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
