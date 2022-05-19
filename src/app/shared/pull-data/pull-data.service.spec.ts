import { TestBed } from '@angular/core/testing';

import { PullDataService } from './pull-data.service';
import { SharedModule } from '../shared.module';

describe('PullDataService', () => {
  let service: PullDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SharedModule] });
    service = TestBed.inject(PullDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
