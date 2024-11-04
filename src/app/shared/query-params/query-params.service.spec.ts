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
          searchParameters: [
            { element: 'code text' },
            { element: 'observation value' }
          ]
        },
        DocumentReference: {
          searchParameters: [{ element: 'description', type: 'string' }]
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

  it('should include modifier for string type search parameter', () => {
    const resourceType = 'DocumentReference';
    const searchParameter: SearchParameter = {
      element: 'description',
      value: {
        testValue: 'note',
        testValueModifier: ':contains',
        testValuePrefix: '',
        testValueUnit: ''
      }
    };

    expect(service.getQueryParam(resourceType, searchParameter)).toEqual(
      '&description:contains=note'
    );
  });

  it('should include second line of range constraints - with Observation codes', () => {
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
        testValue: 200,
        testValueModifier: '',
        testValuePrefix: 'gt',
        testValueUnit: '',
        testValuePrefix2: 'lt',
        testValue2: 230
      }
    };

    expect(service.getQueryParam(resourceType, searchParameter)).toEqual(
      '&combo-code-value-quantity=http%3A%2F%2Floinc.org%7C3137-7%24gt200&combo-code-value-quantity=http%3A%2F%2Floinc.org%7C3137-7%24lt230'
    );
  });

  it('should include second line of range constraints - without Observation codes', () => {
    const resourceType = 'Observation';
    const searchParameter: SearchParameter = {
      element: 'observation value',
      value: {
        observationDataType: 'Quantity',
        testValue: 200,
        testValueModifier: '',
        testValuePrefix: 'gt',
        testValueUnit: 'cm',
        testValuePrefix2: 'lt',
        testValue2: 230
      }
    };

    expect(service.getQueryParam(resourceType, searchParameter)).toEqual(
      '&combo-value-quantity=gt200%7C%7Ccm&combo-value-quantity=lt230%7C%7Ccm'
    );
  });
});
