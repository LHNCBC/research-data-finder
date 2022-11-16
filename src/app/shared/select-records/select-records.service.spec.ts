import { TestBed } from '@angular/core/testing';

import { SelectRecordsService } from './select-records.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('SelectRecordsService', () => {
  let service: SelectRecordsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientTestingModule]
    });
    service = TestBed.inject(SelectRecordsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
