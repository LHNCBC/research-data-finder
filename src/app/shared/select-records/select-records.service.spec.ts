import { TestBed } from '@angular/core/testing';

import { SelectRecordsService } from './select-records.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('SelectRecordsService', () => {
  let service: SelectRecordsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(SelectRecordsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
