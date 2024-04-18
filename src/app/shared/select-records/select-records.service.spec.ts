import { TestBed } from '@angular/core/testing';
import observations from './test-fixtures/observations.json';
import observationsSecondPage
  from './test-fixtures/observations-second-page.json';
import observationsThirdPage
  from './test-fixtures/observations-third-page.json';
import { SelectRecordsService } from './select-records.service';
import { HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpContext, HttpParams, HttpRequest } from '@angular/common/http';
import variables from 'src/test/test-fixtures/variables-4.json';
import studies from 'src/test/test-fixtures/research-studies.json';
import {
  configureTestingModule,
  verifyOutstandingRequests
} from '../../../test/helpers';
import {
  CACHE_NAME,
  FhirBackendService
} from '../fhir-backend/fhir-backend.service';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';
import {
  CustomRxjsOperatorsService
} from '../custom-rxjs-operators/custom-rxjs-operators.service';
import { Sort } from '@angular/material/sort';
import { Subject } from 'rxjs';
import Resource = fhir.Resource;

describe('SelectRecordsService', () => {
  let service: SelectRecordsService;
  let mockHttp: HttpTestingController;
  let fhirBackend: FhirBackendService;
  let customRxjs: CustomRxjsOperatorsService;
  let options: {
    features: any;
  } = {
    features: {
      hasResearchStudy: true,
      hasAvailableStudy: true
    }
  };

  beforeEach(async () => {
    await configureTestingModule(
      {
        imports: [RouterTestingModule, MatDialogModule]
      },
      options
    );
    mockHttp = TestBed.inject(HttpTestingController);
    service = TestBed.inject(SelectRecordsService);
    fhirBackend = TestBed.inject(FhirBackendService);
    customRxjs = TestBed.inject(CustomRxjsOperatorsService);
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
    service.currentState['Variable'].resourceStream.subscribe(() => {});
    mockHttp
      .expectOne((req: HttpRequest<any>) => {
        return (
          req.url ===
            'https://clinicaltables.nlm.nih.gov/api/dbg_vars/v3/search' &&
          new HttpParams({ fromString: req.body }).get('q') ===
            '(display_name:(somename*) OR synonyms:(somename*))'
        );
      })
      .flush(variables);
    expect(service.currentState['Variable'].resources.length).toBe(4);
  });

  it('should search by prefix when filtering by study_id', () => {
    service.loadVariables([], {}, { study_id: 'someid' }, null, 0);
    service.currentState['Variable'].resourceStream.subscribe(() => {});
    mockHttp
      .expectOne((req: HttpRequest<any>) => {
        return (
          req.url ===
            'https://clinicaltables.nlm.nih.gov/api/dbg_vars/v3/search' &&
          new HttpParams({ fromString: req.body }).get('q') ===
            'study_id:(someid*)'
        );
      })
      .flush(variables);
    expect(service.currentState['Variable'].resources.length).toBe(4);
  });

  it('should pass CACHE_NAME to requests for next pages when loading ResearchStudies', () => {
    spyOn(customRxjs, 'takeAllIf').and.callThrough();
    const someCacheName = 'someCacheName';
    const someUrl = 'someUrl';
    const context = new HttpContext().set(CACHE_NAME, someCacheName);
    service.loadFirstPage('ResearchStudy', someUrl, { context });
    // we don't subscribe to the result resource stream, so we don't expect any requests
    expect(customRxjs.takeAllIf).toHaveBeenCalledWith(
      true,
      jasmine.objectContaining({ context })
    );
  });

  describe('loadVariablesFromObservations', () => {
    const emptyBundle = {};

    function loadFirstPageOfObservations(sort = null) {
      service.loadFirstPageOfVariablesFromObservations([], {}, sort);
      service.currentState['Observation'].resourceStream.subscribe();
      mockHttp
        .expectOne('$fhir/Observation?_elements=code,value,category&_count=50')
        .flush(observations);
    }

    /**
     * Returns a matcher, usable in any matcher that uses Jasmine's equality
     * (e.g. toEqual, toContain, or toHaveBeenCalledWith), that will succeed if
     * the actual value is an Array of observations with specified codes.
     * @param codes - array of observation codes
     * @return a matcher, usable in any matcher that uses Jasmine's equality
     */
    function arrayOfObservationsWithCodes(codes: string[]): Resource[] {
      return codes.map((code) =>
        jasmine.objectContaining({
          code: {
            coding: [
              jasmine.objectContaining({code})
            ]
          }
        }) as Resource
      );
    }

    afterEach(() => {
      verifyOutstandingRequests(mockHttp);
    });

    it('should use multiple "code:not" when FHIR server doesn\'t have the :not modifier issue', () => {
      options.features = {
        hasNotModifierIssue: false
      };
      loadFirstPageOfObservations();

      service.loadNextPageOfVariablesFromObservations({}, null);
      service.currentState['Observation'].resourceStream.subscribe();
      mockHttp
        .expectOne(
          '$fhir/Observation?_elements=code,value,category&code:not=system-1%7Ccode-1&code:not=system-2%7Ccode-2&code:not=system-3%7Ccode-3&code:not=system-4%7Ccode-4&_count=50'
        )
        .flush(emptyBundle);
      expect(service.currentState['Observation'].resources.length).toBe(4);
    });

    it('should use single "code:not" when FHIR server has the :not modifier issue', function () {
      options.features = {
        hasNotModifierIssue: true
      };
      loadFirstPageOfObservations();

      service.loadNextPageOfVariablesFromObservations({}, null);
      service.currentState['Observation'].resourceStream.subscribe();
      mockHttp
        .expectOne(
          '$fhir/Observation?_elements=code,value,category&code:not=system-1%7Ccode-1,system-2%7Ccode-2,system-3%7Ccode-3,system-4%7Ccode-4&_count=50'
        )
        .flush(emptyBundle);
      expect(service.currentState['Observation'].resources.length).toBe(4);
    });

    it('should stop loading variables when the next page has no new codes', function() {
      options.features = {
        hasNotModifierIssue: true
      };
      loadFirstPageOfObservations();

      service.loadNextPageOfVariablesFromObservations({}, null);
      service.currentState['Observation'].resourceStream.subscribe();
      mockHttp
        .expectOne(
          '$fhir/Observation?_elements=code,value,category&code:not=system-1%7Ccode-1,system-2%7Ccode-2,system-3%7Ccode-3,system-4%7Ccode-4&_count=50'
        )
        .flush(observations);
      expect(service.currentState['Observation'].resources.length).toBe(4);
      expect(service.currentState['Observation'].nextBundleUrl).toBe(null);
    });


    it('should sort each loaded page on the client side', function() {
      options.features = {
        hasNotModifierIssue: true
      };
      const sort: Sort = {active: 'code', direction: 'asc'};
      spyOn(service, 'sortObservationsByVariableColumn').and.callThrough();
      loadFirstPageOfObservations(sort);
      expect(service.sortObservationsByVariableColumn).toHaveBeenCalledOnceWith(
        arrayOfObservationsWithCodes(['code-1', 'code-2', 'code-3', 'code-4']),
        sort
      );
      (service.sortObservationsByVariableColumn as jasmine.Spy).calls.reset();

      service.loadNextPageOfVariablesFromObservations({}, sort);
      service.currentState['Observation'].resourceStream.subscribe();
      mockHttp
        .expectOne(
          '$fhir/Observation?_elements=code,value,category&code:not=system-1%7Ccode-1,system-2%7Ccode-2,system-3%7Ccode-3,system-4%7Ccode-4&_count=50'
        )
        .flush(observationsSecondPage);
      expect(service.sortObservationsByVariableColumn).toHaveBeenCalledOnceWith(
        arrayOfObservationsWithCodes(['code-5', 'code-6']),
        sort
      );
      expect(service.currentState['Observation'].resources).toEqual(
        arrayOfObservationsWithCodes(['code-4', 'code-3', 'code-2', 'code-1', 'code-6', 'code-5'])
      );
    });


    it('should sort preloaded data before adding them to the list', function() {
      options.features = {
        hasNotModifierIssue: true
      };
      const sort: Sort = {active: 'code', direction: 'asc'};
      spyOn(service, 'sortObservationsByVariableColumn').and.callThrough();
      loadFirstPageOfObservations(sort);
      expect(service.sortObservationsByVariableColumn).toHaveBeenCalledOnceWith(
        arrayOfObservationsWithCodes(['code-1', 'code-2', 'code-3', 'code-4']),
        sort
      );
      (service.sortObservationsByVariableColumn as jasmine.Spy).calls.reset();

      service.preloadNextPageOfVariablesFromObservations({}, sort);
      mockHttp
        .expectOne(
          '$fhir/Observation?_elements=code,value,category&code:not=system-1%7Ccode-1,system-2%7Ccode-2,system-3%7Ccode-3,system-4%7Ccode-4&_count=50'
        )
        .flush(observationsSecondPage);
      expect(service.sortObservationsByVariableColumn).toHaveBeenCalledOnceWith(
        arrayOfObservationsWithCodes(['code-5', 'code-6']),
        sort
      );
      (service.sortObservationsByVariableColumn as jasmine.Spy).calls.reset();

      service.preloadNextPageOfVariablesFromObservations({}, sort);
      mockHttp
        .expectOne(
          '$fhir/Observation?_elements=code,value,category&code:not=system-1%7Ccode-1,system-2%7Ccode-2,system-3%7Ccode-3,system-4%7Ccode-4,system-5%7Ccode-5,system-6%7Ccode-6&_count=50'
        )
        .flush(observationsThirdPage);
      expect(service.sortObservationsByVariableColumn).toHaveBeenCalledOnceWith(
        arrayOfObservationsWithCodes(['code-7', 'code-8', 'code-9']),
        sort
      );
      (service.sortObservationsByVariableColumn as jasmine.Spy).calls.reset();
      expect(service.preloadState['Observation'].resources).toEqual(
        arrayOfObservationsWithCodes(['code-6', 'code-5', 'code-9', 'code-8', 'code-7'])
      );

      service.loadNextPageOfVariablesFromObservations({}, sort);
      service.currentState['Observation'].resourceStream.subscribe();
      expect(service.sortObservationsByVariableColumn).toHaveBeenCalledOnceWith(
        arrayOfObservationsWithCodes(['code-6', 'code-5', 'code-9', 'code-8', 'code-7']),
        sort
      );

      expect(service.currentState['Observation'].resources).toEqual(
        arrayOfObservationsWithCodes(['code-4', 'code-3', 'code-2', 'code-1', 'code-9', 'code-8', 'code-7', 'code-6', 'code-5'])
      );
    });


    it('should use selected studies when loading variables', () => {
      options.features = {
        hasNotModifierIssue: true
      };

      service.loadFirstPageOfVariablesFromObservations(studies.entry.map(i => i.resource), {}, null);

      mockHttp
        .expectOne('$fhir/ResearchSubject?_elements=individual&study=ResearchStudy/phs002410,ResearchStudy/phs002409')
        .flush({
          entry: [
            {resource: {individual: {reference: 'Patient/pat-1'}}},
            {resource: {individual: {reference: 'Patient/pat-2'}}}
          ]
        });

      service.currentState['Observation'].resourceStream.subscribe();
      mockHttp
        .expectOne('$fhir/Observation?_elements=code,value,category&subject=Patient/pat-1,Patient/pat-2&_count=50')
        .flush(observations);
      expect(service.currentState['Observation'].resources).toEqual(
        jasmine.arrayContaining(arrayOfObservationsWithCodes(['code-1', 'code-2', 'code-3', 'code-4']))
      );

      service.loadNextPageOfVariablesFromObservations({}, null);

      service.currentState['Observation'].resourceStream.subscribe();
      mockHttp
        .expectOne(
          '$fhir/Observation?_elements=code,value,category&subject=Patient/pat-1,Patient/pat-2&code:not=system-1%7Ccode-1,system-2%7Ccode-2,system-3%7Ccode-3,system-4%7Ccode-4&_count=50'
        )
        .flush(observationsSecondPage);
      expect(service.currentState['Observation'].resources).toEqual(
        jasmine.arrayContaining(arrayOfObservationsWithCodes(['code-1', 'code-2', 'code-3', 'code-4', 'code-5', 'code-6']))
      );

      service.preloadNextPageOfVariablesFromObservations({}, null);
      mockHttp
        .expectOne(
          '$fhir/Observation?_elements=code,value,category&subject=Patient/pat-1,Patient/pat-2&code:not=system-1%7Ccode-1,system-2%7Ccode-2,system-3%7Ccode-3,system-4%7Ccode-4,system-5%7Ccode-5,system-6%7Ccode-6&_count=50'
        )
        .flush(observationsThirdPage);
      expect(service.preloadState['Observation'].resources).toEqual(
        jasmine.arrayContaining(arrayOfObservationsWithCodes(['code-7', 'code-8', 'code-9']))
      );
    });


    // TODO Remove adding study data to variables
    it('should add study data to variables', () => {
      spyOn(fhirBackend, 'getCurrentDefinitions').and.returnValue({
        valueSetMapByPath: {'ResearchSubject.status': ['someSSubjectStatus']}
      });
      options.features = {
        hasNotModifierIssue: true,
        hasResearchStudy: true,
        hasAvailableStudy: true
      };

      service.currentState['ResearchStudy'] = {
        loading: false,
        resources: [{id: 'study-id-1'}, {id: 'study-id-2'}],
        sortChanged: new Subject<Sort>()
      };

      loadFirstPageOfObservations();

      service.loadNextPageOfVariablesFromObservations({}, null);
      service.currentState['Observation'].resourceStream.subscribe();
      mockHttp
        .expectOne(
          '$fhir/Observation?_elements=code,value,category&code:not=system-1%7Ccode-1,system-2%7Ccode-2,system-3%7Ccode-3,system-4%7Ccode-4&_count=50'
        )
        .flush(emptyBundle);
      expect(service.currentState['Observation'].resources.length).toBe(4);
    });
  });
});
