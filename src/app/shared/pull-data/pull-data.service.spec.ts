import { TestBed } from '@angular/core/testing';

import { PullDataService } from './pull-data.service';
import { SharedModule } from '../shared.module';
import { FhirBackendService } from '../fhir-backend/fhir-backend.service';

describe('PullDataService', () => {
  let service: PullDataService;
  let fhirBackend: FhirBackendService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SharedModule]
    });

    fhirBackend = TestBed.inject(FhirBackendService);
    spyOn(fhirBackend, 'getCurrentDefinitions').and.returnValue({
      resources: {
        MedicationDispense: {
          searchParameters: [{ element: 'code' }]
        },
        MedicationRequest: {
          searchParameters: [{ element: 'code' }]
        }
      }
    } as any);

    service = TestBed.inject(PullDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });


  describe('combineObservationCodes', () => {
    it('should change duplicate display names', () => {
      expect(
        service.getCodesFromCriteria({
          condition: 'and',
          rules: [
            {
              condition: 'and',
              rules: [
                {
                  field: {
                    element: 'code text',
                    value: '',
                    selectedObservationCodes: {
                      coding: [
                        {
                          code: '3137-7',
                          system: 'http://loinc.org'
                        },
                        {
                          code: '11881-0',
                          system: 'http://loinc.org'
                        }
                      ],
                      datatype: 'Quantity',
                      defaultUnit: 'cm',
                      defaultUnitSystem: 'http://unitsofmeasure.org',
                      items: ['Height cm', 'Fundus Height']
                    }
                  }
                }
              ],
              resourceType: 'Observation'
            },
            {
              condition: 'and',
              rules: [
                {
                  field: {
                    element: 'code text',
                    value: '',
                    selectedObservationCodes: {
                      coding: [
                        {
                          code: '3137-7',
                          system: 'http://loinc.org'
                        },
                        {
                          code: '8302-2',
                          system: 'http://loinc.org'
                        }
                      ],
                      datatype: 'Quantity',
                      defaultUnit: 'cm',
                      defaultUnitSystem: 'http://unitsofmeasure.org',
                      items: ['Height cm', 'Height Peds']
                    }
                  }
                }
              ],
              resourceType: 'Observation'
            },
            {
              condition: 'and',
              rules: [
                {
                  field: {
                    element: 'code',
                    value: {
                      codes: ['27250050000320', '27250050000320', '27250050000340'],
                      items: ['METFORMIN     TAB 500MG', 'METFORMIN    TAB 500MG', 'METFORMIN   TAB 850MG']
                    }
                  }
                }
              ],
              resourceType: 'MedicationDispense'
            },
            {
              condition: 'and',
              rules: [
                {
                  field: {
                    element: 'code',
                    value: {
                      codes: ['27250050000320', '27250050000340', '27250050000340'],
                      items: ['METFORMIN     TAB 500MG', 'METFORMIN    TAB 850MG', 'METFORMIN   TAB 850MG']
                    }
                  }
                }
              ],
              resourceType: 'MedicationDispense'
            }
          ]
        })
      ).toEqual({
        Observation: {
          coding: [
            {
              code: '3137-7',
              system: 'http://loinc.org'
            },
            {
              code: '11881-0',
              system: 'http://loinc.org'
            },
            {
              code: '8302-2',
              system: 'http://loinc.org'
            }
          ],
          items: ['Height cm', 'Fundus Height', 'Height Peds'],
          datatype: 'any'
        },
        MedicationDispense: {
          codes: ['27250050000320', '27250050000320', '27250050000340', '27250050000340'],
          items: [
            'METFORMIN     TAB 500MG',
            'METFORMIN    TAB 500MG',
            'METFORMIN   TAB 850MG',
            'METFORMIN    TAB 850MG'
          ]
        },
        MedicationRequest: {
          codes: [],
          items: []
        }
      });
    });


    it('should ignore medication code criteria when no medication code ' +
      'search parameter exists', () => {
      (fhirBackend.getCurrentDefinitions as jasmine.Spy).and.returnValue({
        resources: {
          MedicationDispense: {
            searchParameters: [{ element: 'status' }]
          },
          MedicationRequest: {
            searchParameters: [{ element: 'status' }]
          }
        }
      } as any);

      const criteria = {
        condition: 'and',
        rules: [
          {
            condition: 'and',
            rules: [
              {
                field: {
                  element: 'code',
                  value: {
                    codes: ['27250050000320'],
                    items: ['METFORMIN TAB 500MG']
                  }
                }
              }
            ],
            resourceType: 'MedicationDispense'
          }
        ]
      } as any;

      let result;
      expect(() => {
        result = service.getCodesFromCriteria(criteria);
      }).not.toThrow();
      expect(result).toEqual({
        Observation: {
          coding: [],
          items: [],
          datatype: 'any'
        }
      });
    });
  });

});
