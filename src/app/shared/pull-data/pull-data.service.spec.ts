import { TestBed } from '@angular/core/testing';

import { PullDataService } from './pull-data.service';
import { SharedModule } from '../shared.module';

describe('PullDataService', () => {
  let service: PullDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SharedModule]
    });
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
  });

});
