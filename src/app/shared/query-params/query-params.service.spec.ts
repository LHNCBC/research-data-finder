import { TestBed } from '@angular/core/testing';
import { QueryParamsService } from './query-params.service';
import { SharedModule } from '../shared.module';
import { SearchParameter } from '../../types/search.parameter';
import { FhirBackendService } from '../fhir-backend/fhir-backend.service';

describe('QueryParamsService', () => {
  let service: QueryParamsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SharedModule],
      providers: [FhirBackendService]
    });
    service = TestBed.inject(QueryParamsService);
    const fhirBackendService = TestBed.inject(FhirBackendService);
    spyOn(fhirBackendService, 'getCurrentDefinitions').and.returnValue({
      resources: {
        Observation: {
          searchParameters: [{ element: 'code text' }]
        }
      }
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should preserve 0 of numeric test value input', () => {
    const resourceType = 'Observation';
    const searchParameter: SearchParameter = {
      element: 'code text',
      selectedObservationCodes: {
        datatype: 'Quantity',
        coding: [
          {
            code: '3137-7',
            system: 'http://loinc.org'
          }
        ],
        items: ['Height cm']
      },
      value: {
        observationDataType: 'Quantity',
        testValue: 0,
        testValueModifier: '',
        testValuePrefix: 'gt',
        testValueUnit: ''
      }
    };

    expect(service.getQueryParam(resourceType, searchParameter)).toEqual(
      '&combo-code-value-quantity=http%3A%2F%2Floinc.org%7C3137-7%24gt0'
    );
  });
});
