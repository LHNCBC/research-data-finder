import { TestBed } from '@angular/core/testing';

import { CohortService } from './cohort.service';
import { SharedModule } from '../shared.module';
import { last } from 'rxjs/operators';
import tenObservationBundle
  from '../../modules/step-2-define-cohort-page/test-fixtures/observations-10.json';
import tenPatientBundle
  from '../../modules/step-2-define-cohort-page/test-fixtures/patients-10.json';
import examplePatient
  from '../../modules/step-2-define-cohort-page/test-fixtures/example-patient.json';
import {
  HttpTestingController,
  HttpClientTestingModule
} from '@angular/common/http/testing';
import { Criteria, ResourceTypeCriteria } from '../../types/search-parameters';
import { configureTestingModule } from 'src/test/helpers';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

describe('CohortService', () => {
  let cohort: CohortService;
  let mockHttp: HttpTestingController;

  beforeEach(async () => {
    await configureTestingModule({
      imports: [SharedModule, HttpClientTestingModule, RouterTestingModule]
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
          resource: {...examplePatient, id: patientId}
        }))
      });
  });


  it('should correctly process nested ANDed criteria if parent nodes are ORed', (done) => {
    const criteria: Criteria = {
      'condition': 'and',
      'rules': [
        {
          'condition': 'and',
          'rules': [
            {
              'field': {
                'element': 'code text',
                'value': '',
                'selectedObservationCodes': {
                  'coding': [
                    {
                      'code': '72166-2',
                      'system': 'http://loinc.org'
                    }
                  ],
                  'datatype': 'CodeableConcept',
                  'items': [
                    'Tobacco smoking status'
                  ]
                }
              }
            }
          ],
          'resourceType': 'Observation'
        },
        {
          'condition': 'or',
          'rules': [
            {
              'condition': 'and',
              'rules': [
                {
                  'field': {
                    'element': 'active',
                    'value': 'false'
                  }
                }
              ],
              'resourceType': 'Patient'
            },
            {
              'condition': 'and',
              'rules': [
                {
                  'field': {
                    'element': 'gender',
                    'value': {
                      'codes': [
                        'male'
                      ],
                      'items': [
                        'Male'
                      ]
                    }
                  }
                }
              ],
              'resourceType': 'Patient'
            }
          ]
        }
      ]
    };

    cohort.searchForPatients(criteria, 20);
    cohort.patientStream.pipe(last()).subscribe((patients) => {
      expect(patients.length).toEqual(10);
      done();
    });

    mockHttp
      .expectOne(
        '$fhir/Patient?_total=accurate&_summary=count&_has:Observation:subject:combo-code=http%3A%2F%2Floinc.org%7C72166-2'
      )
      .flush({total: 10});

    mockHttp
      .expectOne('$fhir/Patient?_total=accurate&_summary=count&active=false')
      .flush({total: 20});

    mockHttp
      .expectOne('$fhir/Patient?_total=accurate&_summary=count&gender=male')
      .flush({total: 30});

    mockHttp
      .expectOne(
        '$fhir/Patient?_count=20&_has:Observation:subject:combo-code=http%3A%2F%2Floinc.org%7C72166-2'
      )
      .flush(tenPatientBundle);

    tenPatientBundle.entry.forEach(({resource}) => {
      mockHttp
        .expectOne(`$fhir/Patient?_id=${resource.id}&active=false`)
        .flush({total: 0});
    });

    tenPatientBundle.entry.forEach(({resource}) => {
      mockHttp
        .expectOne(`$fhir/Patient?_id=${resource.id}&gender=male`)
        .flush({total: 1, entry: [{resource}]});
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
      jasmine.objectContaining({observationDataType: 'CodeableConcept'})
    );
    expect(Object.keys(criteria.rules[0].rules[1].field)).not.toContain(
      'observationDataType'
    );
  });


  /**
   * Creates an example of criteria for a resource type.
   * @param resourceType resource type with a prefix or suffix describing its modification
   * @return a new object describes criteria to select Patient resources.
   */
  function getCriteriaFor(
    resourceType: 'Patient' | 'ResearchStudy' | 'otherResearchStudy'
      | 'Condition' | 'PatientForResearchStudy' | 'PatientForOtherResearchStudy'
      | 'PatientCombinedWithPatientForResearchStudy' | 'nonexistentResearchStudy'
      | 'PatientForCondition'
  ): ResourceTypeCriteria {
    switch (resourceType) {
      case 'Patient':
        return {
          condition: 'and',
          resourceType: 'Patient',
          rules: [
            {
              field: {
                element: 'gender',
                value: {
                  codes: ['female'],
                  items: ['Female']
                }
              }
            }
          ]
        };
      case 'ResearchStudy':
      case 'otherResearchStudy':
      case 'nonexistentResearchStudy':
        return {
          condition: 'and',
          resourceType: 'ResearchStudy',
          rules: [
            {
              field: {
                element: 'title',
                value: {
                  testValuePrefix: '',
                  testValueModifier: '',
                  testValue: {
                    ResearchStudy: 'a',
                    otherResearchStudy: 'b',
                    nonexistentResearchStudy: 'nonexistent'
                  }[resourceType],
                  testValueUnit: '',
                  testValuePrefix2: '',
                  testValue2: '',
                  observationDataType: 'String'
                }
              }
            }
          ]
        };
      case 'PatientForResearchStudy':
      case 'PatientForOtherResearchStudy':
        return {
          condition: 'and',
          resourceType: 'Patient',
          rules: [
            {
              field: {
                element: '_has:ResearchSubject:individual:study',
                value: resourceType === 'PatientForResearchStudy' ? 'study-1,study-2' : 'study-3'
              }
            }
          ]
        };
      case 'PatientCombinedWithPatientForResearchStudy':
        return {
          condition: 'and',
          resourceType: 'Patient',
          rules: [
            {
              field: {
                element: 'gender',
                value: {
                  codes: ['female'],
                  items: ['Female']
                }
              }
            },
            {
              field: {
                element: '_has:ResearchSubject:individual:study',
                value: 'study-1,study-2'
              }
            }
          ]
        };
      case 'Condition':
        return {
          condition: 'and',
          resourceType: 'Condition',
          rules: [
            {
              field: {
                element: 'code',
                value: {
                  codes: ['276.3'],
                  items: ['ALKALOSIS']
                }
              }
            }
          ]
        };
      case 'PatientForCondition':
        return {
          condition: 'and',
          resourceType: 'Patient',
          rules: [
            {
              field: {
                element: '_has:Condition:subject:code',
                value: '276.3'
              }
            }
          ]
        };
    }
  }


  describe('simplifyCriteriaTree', () => {
    it('should move ANDed child criteria to the parent criteria', () => {
      expect(
        cohort.simplifyCriteriaTree({
          condition: 'and',
          rules: [
            getCriteriaFor('Patient'),
            {
              condition: 'and',
              rules: [
                getCriteriaFor('ResearchStudy'),
                getCriteriaFor('Condition')
              ]
            }
          ]
        })
      ).toEqual({
        condition: 'and',
        rules: [
          getCriteriaFor('Patient'),
          getCriteriaFor('ResearchStudy'),
          getCriteriaFor('Condition')
        ]
      });
    });


    it('should not move ORed child criteria to the parent criteria', () => {
      expect(
        cohort.simplifyCriteriaTree({
          condition: 'and',
          rules: [
            getCriteriaFor('Patient'),
            {
              condition: 'or',
              rules: [
                getCriteriaFor('ResearchStudy'),
                getCriteriaFor('Condition')
              ]
            }
          ]
        })
      ).toEqual({
        condition: 'and',
        rules: [
          getCriteriaFor('Patient'),
          {
            condition: 'or',
            rules: [
              getCriteriaFor('ResearchStudy'),
              getCriteriaFor('Condition')
            ]
          }
        ]
      });

      expect(
        cohort.simplifyCriteriaTree({
          condition: 'or',
          rules: [
            getCriteriaFor('Patient'),
            {
              condition: 'and',
              rules: [
                getCriteriaFor('ResearchStudy'),
                getCriteriaFor('Condition')
              ]
            }
          ]
        })
      ).toEqual({
        condition: 'or',
        rules: [
          getCriteriaFor('Patient'),
          {
            condition: 'and',
            rules: [
              getCriteriaFor('ResearchStudy'),
              getCriteriaFor('Condition')
            ]
          }
        ]
      });
    });
  });


  describe('replaceOtherResourceCriteriaWithPatientCriteria', () => {
    it('should replace ResearchStudy criteria with patient criteria', (done) => {
      cohort.replaceOtherResourceCriteriaWithPatientCriteria(of({
        'condition': 'and',
        'rules': [
          {
            'condition': 'and',
            'rules': [
              getCriteriaFor('Patient'),
              getCriteriaFor('ResearchStudy'),
              getCriteriaFor('Condition')
            ]
          },
          {
            'condition': 'or',
            'rules': [
              getCriteriaFor('Patient'),
              getCriteriaFor('otherResearchStudy'),
              {
                condition: 'and',
                rules: [
                  getCriteriaFor('Condition'),
                ]
              },
              {
                condition: 'and',
                rules: [
                  getCriteriaFor('Condition'),
                  getCriteriaFor('nonexistentResearchStudy'),
                ]
              }
            ]
          }
        ]
      })).subscribe((criteria) => {
        expect(criteria).toEqual({
          'condition': 'and',
          'rules': [
            {
              'condition': 'and',
              'rules': [
                getCriteriaFor('Patient'),
                getCriteriaFor('PatientForResearchStudy'),
                getCriteriaFor('PatientForCondition')
              ]
            },
            {
              'condition': 'or',
              'rules': [
                getCriteriaFor('Patient'),
                getCriteriaFor('PatientForOtherResearchStudy'),
                {
                  condition: 'and',
                  rules: [
                    getCriteriaFor('PatientForCondition'),
                  ]
                }
              ]
            }
          ]
        });

        done();
      });

      mockHttp
        .expectOne(
          '$fhir/ResearchStudy?_elements=id&_has:ResearchSubject:study:status=candidate,eligible,follow-up,ineligible,not-registered,off-study,on-study,on-study-intervention,on-study-observation,pending-on-study,potential-candidate,screening,withdrawn&title=a'
        )
        .flush({
          entry: [{resource: {id: 'study-1'}}, {resource: {id: 'study-2'}}]
        });
      mockHttp
        .expectOne(
          '$fhir/ResearchStudy?_elements=id&_has:ResearchSubject:study:status=candidate,eligible,follow-up,ineligible,not-registered,off-study,on-study,on-study-intervention,on-study-observation,pending-on-study,potential-candidate,screening,withdrawn&title=b'
        )
        .flush({
          entry: [{resource: {id: 'study-3'}}]
        });
      mockHttp
        .expectOne(
          '$fhir/ResearchStudy?_elements=id&_has:ResearchSubject:study:status=candidate,eligible,follow-up,ineligible,not-registered,off-study,on-study,on-study-intervention,on-study-observation,pending-on-study,potential-candidate,screening,withdrawn&title=nonexistent'
        )
        .flush({
          entry: []
        });
    });
  });


  describe('combineANDedCriteriaForPatient', () => {
    it('should combine ANDed criteria for Patient', () => {
      expect(
        cohort.combineANDedCriteriaForPatient({
          condition: 'and',
          rules: [
            {
              condition: 'and',
              rules: [
                getCriteriaFor('Patient'),
                getCriteriaFor('PatientForResearchStudy'),
                getCriteriaFor('Condition')]
            },
            {
              condition: 'or',
              rules: [
                getCriteriaFor('Patient'),
                getCriteriaFor('PatientForOtherResearchStudy'),
                getCriteriaFor('Condition')
              ]
            }
          ]
        })
      ).toEqual({
        condition: 'and',
        rules: [
          {
            condition: 'and',
            rules: [
              getCriteriaFor('Condition'),
              getCriteriaFor('PatientCombinedWithPatientForResearchStudy')
            ]
          },
          {
            condition: 'or',
            rules: [
              getCriteriaFor('Patient'),
              getCriteriaFor('PatientForOtherResearchStudy'),
              getCriteriaFor('Condition')
            ]
          }
        ]
      });
    });
  });

});
