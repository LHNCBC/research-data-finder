import { TestBed } from '@angular/core/testing';

import { SelectRecordsService } from './select-records.service';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpRequest } from '@angular/common/http';
import variables from 'src/test/test-fixtures/variables-4.json';

describe('SelectRecordsService', () => {
  let service: SelectRecordsService;
  let mockHttp: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientTestingModule]
    });
    mockHttp = TestBed.inject(HttpTestingController);
    service = TestBed.inject(SelectRecordsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should request for synonyms when filtering by display_name', () => {
    service.loadVariables(
      [],
      {},
      { display_name: 'somename' },
      { active: 'dispay_name', direction: 'desc' },
      0
    );
    service.resourceStream['Variable'].subscribe(() => {});
    mockHttp
      .expectOne((req: HttpRequest<any>) => {
        return (
          req.url ===
            'https://clinicaltables.nlm.nih.gov/api/dbg_vars/v3/search' &&
          req.params.get('q') ===
            '(display_name:(somename) OR synonyms:(somename))'
        );
      })
      .flush(variables);
    expect(service.currentState['Variable'].resources.length).toBe(4);
  });
});
