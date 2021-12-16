import { TestBed } from '@angular/core/testing';
import { QueryParamsService } from './query-params.service';
import { SharedModule } from '../shared.module';

describe('QueryParamsService', () => {
  let service: QueryParamsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SharedModule]
    });
    service = TestBed.inject(QueryParamsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
