import { TestBed } from '@angular/core/testing';

import { CohortService } from './cohort.service';
import { SharedModule } from '../shared.module';
import { last } from 'rxjs/operators';
import tenObservationBundle from '../../modules/step-2-define-cohort-page/test-fixtures/observations-10.json';
import examplePatient from '../../modules/step-2-define-cohort-page/test-fixtures/example-patient.json';
import {
  HttpTestingController,
  HttpClientTestingModule
} from '@angular/common/http/testing';
import { Criteria } from '../../types/search-parameters';
import { configureTestingModule } from '../../../test/helpers';

describe('CohortService', () => {
  let cohort: CohortService;
  let mockHttp: HttpTestingController;

  beforeEach(async () => {
    await configureTestingModule({
      imports: [SharedModule, HttpClientTestingModule]
    });
    mockHttp = TestBed.inject(HttpTestingController);
    cohort = TestBed.inject(CohortService);
  });

  it('should be created', () => {
    expect(cohort).toBeTruthy();
  });

  it('should load Patients without using _has when using modifier on the Observation value', (done) => {
    const criteria: Criteria = {
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
                      code: '9317-9',
                      system: 'http://loinc.org'
                    }
                  ],
                  datatype: 'String',
                  items: ['Platelet Bld Ql Smear']
                }
              }
            },
            {
              field: {
                element: 'observation value',
                value: {
                  testValuePrefix: '',
                  testValueModifier: ':contains',
                  testValue: 'a',
                  testValueUnit: '',
                  observationDataType: 'String'
                }
              }
            }
          ],
          resourceType: 'Observation'
        }
      ]
    };
    cohort.searchForPatients(criteria, 20);

    cohort.patientStream.pipe(last()).subscribe((patients) => {
      expect(patients.length).toEqual(9);
      done();
    });

    mockHttp
      .expectOne(
        '$fhir/Observation?_count=20&_elements=subject&code-value-string:contains=http%3A%2F%2Floinc.org%7C9317-9%24a'
      )
      .flush(tenObservationBundle);

    const patientIds = [
      // Search ignores duplicate Patients
      ...new Set(
        tenObservationBundle.entry.map(({ resource }) =>
          resource.subject.reference.replace(/^Patient\//, '')
        )
      )
    ];

    mockHttp
      .expectOne(
        `$fhir/Patient?_id=${patientIds.join(',')}&_count=${patientIds.length}`
      )
      .flush({
        entry: patientIds.map((patientId) => ({
          resource: { ...examplePatient, id: patientId }
        }))
      });
  });

  it('should update old format criteria for observationDataType', () => {
    const criteria = {
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
                      code: '44255-8',
                      system: 'http://loinc.org'
                    }
                  ],
                  datatype: 'CodeableConcept',
                  items: ['Feeling down, depressed, or hopeless?']
                }
              }
            },
            {
              field: {
                element: 'observation value',
                value: {
                  testValuePrefix: '',
                  testValueModifier: '',
                  testValue: {
                    codes: ['LA6569-3', 'LA6568-5'],
                    items: ['Several days', 'Not at all']
                  },
                  testValueUnit: ''
                },
                observationDataType: 'CodeableConcept'
              }
            }
          ],
          resourceType: 'Observation'
        }
      ]
    };
    expect(criteria.rules[0].rules[1].field.observationDataType).toBe(
      'CodeableConcept'
    );
    expect(Object.keys(criteria.rules[0].rules[1].field.value)).not.toContain(
      'observationDataType'
    );
    cohort.updateOldFormatCriteria(criteria);
    expect(criteria.rules[0].rules[1].field.value).toEqual(
      jasmine.objectContaining({ observationDataType: 'CodeableConcept' })
    );
    expect(Object.keys(criteria.rules[0].rules[1].field)).not.toContain(
      'observationDataType'
    );
  });
});
