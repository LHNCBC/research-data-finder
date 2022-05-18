import { TestBed } from '@angular/core/testing';

import { CohortService } from './cohort.service';
import { SharedModule } from '../shared.module';

describe('CohortService', () => {
  let service: CohortService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SharedModule] });
    service = TestBed.inject(CohortService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
