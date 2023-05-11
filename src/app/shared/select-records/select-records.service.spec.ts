import { TestBed } from '@angular/core/testing';
import observations from './test-fixtures/observations.json';

import { SelectRecordsService } from './select-records.service';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpParams, HttpRequest } from '@angular/common/http';
import variables from 'src/test/test-fixtures/variables-4.json';
import { verifyOutstandingRequests } from '../../../test/helpers';
import { FhirBackendService } from '../fhir-backend/fhir-backend.service';

describe('SelectRecordsService', () => {
  let service: SelectRecordsService;
  let mockHttp: HttpTestingController;
  let fhirBackend: FhirBackendService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientTestingModule]
    });
    mockHttp = TestBed.inject(HttpTestingController);
    service = TestBed.inject(SelectRecordsService);
    fhirBackend = TestBed.inject(FhirBackendService);
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
          new HttpParams({ fromString: req.body }).get('q') ===
            '(display_name:(somename) OR synonyms:(somename))'
        );
      })
      .flush(variables);
    expect(service.currentState['Variable'].resources.length).toBe(4);
  });

  describe('loadVariablesFromObservations', () => {
    const emptyBundle = {};

    function loadFirstPageOfObservations() {
      service.loadVariablesFromObservations([], {}, {}, null, true);
      service.resourceStream['Observation'].subscribe();
      mockHttp
        .expectOne('$fhir/Observation?_elements=code,value,category&_count=50')
        .flush(observations);
    }

    afterEach(() => {
      verifyOutstandingRequests(mockHttp);
    });

    it('should use multiple "code:not" when FHIR server doesn\'t have the :not modifier issue', () => {
      spyOnProperty(fhirBackend, 'features').and.returnValue({
        ...fhirBackend.features,
        hasNotModifierIssue: false
      });
      loadFirstPageOfObservations();

      service.loadVariablesFromObservations([], {}, {}, null, false);
      service.resourceStream['Observation'].subscribe();
      mockHttp
        .expectOne(
          '$fhir/Observation?_elements=code,value,category&code:not=http://loinc.org%7C11881-0&code:not=http://loinc.org%7C3137-7&code:not=http://loinc.org%7C8302-2&code:not=http://loinc.org%7C8303-0&_count=50'
        )
        .flush(emptyBundle);
      expect(service.currentState['Observation'].resources.length).toBe(4);
    });

    it('should use single "code:not" when FHIR server has the :not modifier issue', function () {
      spyOnProperty(fhirBackend, 'features').and.returnValue({
        ...fhirBackend.features,
        hasNotModifierIssue: true
      });
      loadFirstPageOfObservations();

      service.loadVariablesFromObservations([], {}, {}, null, false);
      service.resourceStream['Observation'].subscribe();
      mockHttp
        .expectOne(
          '$fhir/Observation?_elements=code,value,category&code:not=http://loinc.org%7C11881-0,http://loinc.org%7C3137-7,http://loinc.org%7C8302-2,http://loinc.org%7C8303-0&_count=50'
        )
        .flush(emptyBundle);
      expect(service.currentState['Observation'].resources.length).toBe(4);
    });

    it('should add study data to variables', () => {
      spyOn(fhirBackend, 'getCurrentDefinitions').and.returnValue({
        valueSetMapByPath: { 'ResearchSubject.status': ['someSSubjectStatus'] }
      });
      spyOnProperty(fhirBackend, 'features').and.returnValue({
        ...fhirBackend.features,
        hasNotModifierIssue: true,
        hasResearchStudy: true
      });

      service.currentState['ResearchStudy'] = {
        loading: false,
        resources: [{ id: 'study-id-1' }, { id: 'study-id-2' }]
      };

      loadFirstPageOfObservations();

      const patientWithSubjects = {
        resourceType: 'Bundle',
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'pat-88189'
            }
          },
          {
            resource: {
              resourceType: 'ResearchSubject',
              study: {
                reference: 'ResearchStudy/study-id-1'
              }
            }
          },
          {
            resource: {
              resourceType: 'ResearchSubject',
              study: {
                reference: 'ResearchStudy/study-id-2'
              }
            }
          }
        ]
      };
      [
        '$fhir/Patient?_has:Observation:subject:code=http://loinc.org%7C11881-0&_has:ResearchSubject:individual:status=0&_revinclude=ResearchSubject:subject&_elements=id&_count=1',
        '$fhir/Patient?_has:Observation:subject:code=http://loinc.org%7C3137-7&_has:ResearchSubject:individual:status=0&_revinclude=ResearchSubject:subject&_elements=id&_count=1',
        '$fhir/Patient?_has:Observation:subject:code=http://loinc.org%7C8302-2&_has:ResearchSubject:individual:status=0&_revinclude=ResearchSubject:subject&_elements=id&_count=1',
        '$fhir/Patient?_has:Observation:subject:code=http://loinc.org%7C8303-0&_has:ResearchSubject:individual:status=0&_revinclude=ResearchSubject:subject&_elements=id&_count=1'
      ].forEach((url) => {
        mockHttp.expectOne(url).flush(patientWithSubjects);
      });

      service.loadVariablesFromObservations([], {}, {}, null, false);
      service.resourceStream['Observation'].subscribe();
      mockHttp
        .expectOne(
          '$fhir/Observation?_elements=code,value,category&code:not=http://loinc.org%7C11881-0,http://loinc.org%7C3137-7,http://loinc.org%7C8302-2,http://loinc.org%7C8303-0&_count=50'
        )
        .flush(emptyBundle);
      expect(service.currentState['Observation'].resources.length).toBe(4);
      service.currentState['Observation'].resources.forEach((obs) => {
        expect(obs.studyData.length).toBe(2);
      });
    });
  });
});
