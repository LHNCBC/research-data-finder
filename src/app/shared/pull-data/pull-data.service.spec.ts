import { TestBed } from '@angular/core/testing';

import { PullDataService } from './pull-data.service';
import { SharedModule } from '../shared.module';
import { RouterTestingModule } from '@angular/router/testing';

describe('PullDataService', () => {
  let service: PullDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SharedModule, RouterTestingModule]
    });
    service = TestBed.inject(PullDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
