import { TestBed } from '@angular/core/testing';
import { CACHE_NAME, FhirBackendService } from './fhir-backend.service';
import { FhirBackendModule } from './fhir-backend.module';
import { FhirBatchQuery, HTTP_ABORT, PRIORITIES, OAUTH2_REQUIRED } from './fhir-batch-query';
import { newServer } from 'mock-xmlhttprequest';
import {
  HttpClient,
  HttpClientModule,
  HttpContext,
  HttpResponse,
  HttpXhrBackend
} from '@angular/common/http';
import { of } from 'rxjs';
import { SettingsService } from '../settings-service/settings.service';
import { FhirService } from '../fhir-service/fhir.service';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef
} from '@angular/material/dialog';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AlertDialogComponent } from '../alert-dialog/alert-dialog.component';
import queryResponseCache from './query-response-cache';
import MockXhrServer from 'mock-xmlhttprequest/dist/types/MockXhrServer';
import { RasTokenService } from '../ras-token/ras-token.service';
import { CohortService, CreateCohortMode } from '../cohort/cohort.service';

describe('FhirBackendService', () => {
  let service: FhirBackendService;
  let httpClient: HttpClient;
  let defaultHttpXhrBackend: HttpXhrBackend;
  let matDialog: MatDialog;
  let dialogOpenSpy: jasmine.Spy;
  let rasTokenService: RasTokenService;
  let cohortService: CohortService;
  const responseFromDefaultBackend = new HttpResponse({
    status: 200,
    body: 'response from default backend'
  });
  const responseFromFhirBatchQuery = {
    status: 200,
    data: 'response from FhirBatchQuery'
  };
  const responseFromFhirBatchQuery401 = {
    status: 401,
    data: 'response from FhirBatchQuery 401'
  };
  const responseFromFhirBatchQueryCache = {
    status: 200,
    data: 'response from FhirBatchQuery cache'
  };
  const responseFromFhirBatchQueryCache400 = {
    status: 400,
    data: 'response from FhirBatchQuery cache 400'
  };
  const csvDefinitions = {
    Observation: {
      columnDescriptions: [],
      searchParameters: []
    }
  };

  describe('non-dbGaP', () => {
    beforeEach(async () => {
      TestBed.configureTestingModule({
        imports: [FhirBackendModule, HttpClientModule, MatDialogModule]
      });
      spyOn(FhirBatchQuery.prototype, 'initialize').and.resolveTo(null);
      spyOn(FhirBatchQuery.prototype, 'get').and.resolveTo(
        responseFromFhirBatchQuery
      );
      spyOn(FhirBatchQuery.prototype, 'getWithCache').and.resolveTo(
        responseFromFhirBatchQueryCache
      );
      spyOn(FhirBatchQuery.prototype, 'getVersionName').and.returnValue('R4');
      service = TestBed.inject(FhirBackendService);
      httpClient = TestBed.inject(HttpClient);
      defaultHttpXhrBackend = TestBed.inject(HttpXhrBackend);
      spyOn(defaultHttpXhrBackend, 'handle').and.returnValue(
        of(responseFromDefaultBackend)
      );
      service.settings = TestBed.inject(SettingsService);
      spyOn(service.settings, 'loadCsvDefinitions').and.returnValue(
        of(csvDefinitions)
      );
      spyOn(service.settings, 'getDbgapUrlPattern').and.returnValue(
        '^https://dbgap-api.ncbi.nlm.nih.gov/fhir'
      );
      spyOn(service, 'isDbgap').and.returnValue(false);
      service.cacheEnabled = true;
      await service.init();
      service.fhirClient._features = {batch: true, interpretation: true};
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize FhirBatchQuery', () => {
      expect(FhirBatchQuery.prototype.initialize).toHaveBeenCalledOnceWith(
        'https://lforms-fhir.nlm.nih.gov/baseR5',
        '',
        null
      );
    });

    it('should add interpretation search parameter', (done) => {
      service.currentDefinitions$.subscribe((definitions) => {
        expect(
          definitions.resources.Observation.searchParameters.some(
            (sp) => sp.element === 'interpretation'
          )
        ).toBeTrue();
        done();
      });
    });

    it('should pass through non-FHIR requests', (done) => {
      httpClient.get('some_url').subscribe((response) => {
        expect(response).toBe(responseFromDefaultBackend.body);
        done();
      });
    });

    it('should patch URL for non-GET FHIR requests', (done) => {
      httpClient.post('$fhir/some_related_url', '').subscribe((response) => {
        expect(response).toBe(responseFromDefaultBackend.body);
        expect(defaultHttpXhrBackend.handle).toHaveBeenCalledWith(
          jasmine.objectContaining({
            url: service.serviceBaseUrl + '/some_related_url'
          })
        );
        done();
      });
    });

    it('should pass GET FHIR requests with endpoint to FhirBatchQuery with option combine=true', (done) => {
      httpClient.get('$fhir/some_related_url').subscribe((response) => {
        expect(response).toBe(responseFromFhirBatchQueryCache.data);
        expect(FhirBatchQuery.prototype.getWithCache).toHaveBeenCalledWith(
          service.serviceBaseUrl + '/some_related_url',
          {
            combine: true,
            signal: jasmine.any(AbortSignal),
            cacheName: '',
            priority: PRIORITIES.NORMAL
          }
        );
        done();
      });
    });

    it('should pass GET FHIR requests without endpoint to FhirBatchQuery with option combine=false', (done) => {
      httpClient.get('$fhir?some_params').subscribe((response) => {
        expect(response).toBe(responseFromFhirBatchQueryCache.data);
        expect(FhirBatchQuery.prototype.getWithCache).toHaveBeenCalledWith(
          service.serviceBaseUrl + '?some_params',
          {
            combine: false,
            signal: jasmine.any(AbortSignal),
            cacheName: '',
            priority: PRIORITIES.NORMAL
          }
        );
        done();
      });
    });

    it('should be able to disable cache', (done) => {
      service.cacheEnabled = false;
      httpClient.get('$fhir/some_related_url').subscribe((response) => {
        expect(response).toBe(responseFromFhirBatchQuery.data);
        expect(FhirBatchQuery.prototype.get).toHaveBeenCalledWith(
          service.serviceBaseUrl + '/some_related_url',
          {
            signal: jasmine.any(AbortSignal),
            combine: true,
            priority: PRIORITIES.NORMAL
          }
        );
        done();
      });
    });

    it('should pass cacheName with serverBaseUrl as suffix', (done) => {
      httpClient
        .get('$fhir/some_related_url', {
          context: new HttpContext().set(CACHE_NAME, 'some-cache-name')
        })
        .subscribe((response) => {
          expect(response).toBe(responseFromFhirBatchQueryCache.data);
          expect(FhirBatchQuery.prototype.getWithCache).toHaveBeenCalledWith(
            service.serviceBaseUrl + '/some_related_url',
            {
              combine: true,
              signal: jasmine.any(AbortSignal),
              cacheName:
                'some-cache-name-https://lforms-fhir.nlm.nih.gov/baseR5',
              priority: PRIORITIES.NORMAL
            }
          );
          done();
        });
    });

    it('should use fhirclient authorization header for FhirBatchQuery', async () => {
      service.smartConnectionSuccess = true;
      service.isSmartOnFhirEnabled = true;
      const fhirService = TestBed.inject(FhirService);
      const fhirClient = jasmine.createSpyObj('FhirClient', [
        'getAuthorizationHeader'
      ]);
      const authorizationHeader = 'Bearer some_data';
      fhirClient.getAuthorizationHeader.and.returnValue(authorizationHeader);
      spyOn(fhirService, 'getSmartConnection').and.returnValue(fhirClient);
      spyOn(service, 'checkSmartOnFhirEnabled').and.resolveTo(true);
      spyOn(FhirBatchQuery.prototype, 'setAuthorizationHeader');
      await service.initializeFhirBatchQuery();
      expect(fhirClient.getAuthorizationHeader).toHaveBeenCalledOnceWith();
      expect(
        FhirBatchQuery.prototype.setAuthorizationHeader
      ).toHaveBeenCalledOnceWith(authorizationHeader);
    });
  });

  describe('dbGaP', () => {
    beforeEach(async () => {
      TestBed.configureTestingModule({
        imports: [FhirBackendModule, MatDialogModule, BrowserAnimationsModule]
      });
      spyOn(FhirBatchQuery.prototype, 'initialize').and.resolveTo(null);
      spyOn(FhirBatchQuery.prototype, 'get').and.resolveTo(
        responseFromFhirBatchQuery
      );
      spyOn(FhirBatchQuery.prototype, 'getWithCache').and.rejectWith(
        responseFromFhirBatchQueryCache400
      );
      spyOn(FhirBatchQuery.prototype, 'getVersionName').and.returnValue('R4');
      service = TestBed.inject(FhirBackendService);
      httpClient = TestBed.inject(HttpClient);
      defaultHttpXhrBackend = TestBed.inject(HttpXhrBackend);
      matDialog = TestBed.inject(MatDialog);
      rasTokenService = TestBed.inject(RasTokenService);
      rasTokenService.rasTokenValidated = true;
      cohortService = TestBed.inject(CohortService);
      cohortService.createCohortMode = CreateCohortMode.SEARCH;
      dialogOpenSpy = spyOn(matDialog, 'open');
      spyOn(defaultHttpXhrBackend, 'handle').and.returnValue(
        of(responseFromDefaultBackend)
      );
      service.settings = TestBed.inject(SettingsService);
      spyOn(service.settings, 'loadCsvDefinitions').and.returnValue(
        of(csvDefinitions)
      );
      spyOn(service.settings, 'getDbgapUrlPattern').and.returnValue(
        '^https://dbgap-api.ncbi.nlm.nih.gov/fhir'
      );
      spyOn(service, 'isDbgap').and.returnValue(true);
      service.cacheEnabled = true;
      await service.init();
      service.fhirClient._features = { batch: true, interpretation: true };
    });

    it('should show message if dbGaP TST token has expired', (done) => {
      httpClient.get('$fhir/some_related_url').subscribe(
        () => {},
        (response) => {
          expect(response?.status).toBe(400);
          expect(FhirBatchQuery.prototype.getWithCache).toHaveBeenCalledWith(
            service.serviceBaseUrl + '/some_related_url',
            {
              combine: true,
              signal: jasmine.any(AbortSignal),
              cacheName: '',
              priority: PRIORITIES.NORMAL
            }
          );
          dialogOpenSpy.and.callFake(() => {
            expect(matDialog.open).toHaveBeenCalled();
            done();
            return {
              afterClosed: () => of(false)
            } as MatDialogRef<AlertDialogComponent>;
          });
        }
      );
    });

    it('should not show token expired message if browsing public data', (done) => {
      cohortService.createCohortMode = CreateCohortMode.NO_COHORT;
      httpClient.get('$fhir/some_related_url').subscribe(
        () => {},
        (response) => {
          expect(response?.status).toBe(400);
          expect(FhirBatchQuery.prototype.getWithCache).toHaveBeenCalledWith(
            service.serviceBaseUrl + '/some_related_url',
            {
              combine: true,
              signal: jasmine.any(AbortSignal),
              cacheName: '',
              priority: PRIORITIES.NORMAL
            }
          );
          setTimeout(() => {
            expect(matDialog.open).not.toHaveBeenCalled();
            done();
          }, 1);
        }
      );
    });
  });

  describe('caching', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [FhirBackendModule, MatDialogModule, BrowserAnimationsModule]
      });
      spyOn(FhirBatchQuery.prototype, 'initialize').and.resolveTo(null);
      spyOn(FhirBatchQuery.prototype, 'getVersionName').and.returnValue('R4');
      spyOn(FhirBatchQuery.prototype, 'getFullUrl').and.returnValue('full_url');
      spyOn(queryResponseCache, 'get').and.resolveTo(undefined);
      spyOn(queryResponseCache, 'add').and.resolveTo();
      service = TestBed.inject(FhirBackendService);
      httpClient = TestBed.inject(HttpClient);
      defaultHttpXhrBackend = TestBed.inject(HttpXhrBackend);
    });

    it('should not cache 401 response', (done) => {
      spyOn(FhirBatchQuery.prototype, 'get').and.rejectWith(
        responseFromFhirBatchQuery401
      );
      FhirBatchQuery.prototype
        .getWithCache('some_url', { cacheErrors: true })
        .then(
          () => {},
          (response) => {
            expect(response?.status).toBe(401);
            expect(FhirBatchQuery.prototype.get).toHaveBeenCalledWith(
              'full_url',
              {
                combine: true,
                cacheName: null,
                retryCount: 3,
                cacheErrors: true,
                cacheAbort: false,
                priority: PRIORITIES.NORMAL
              }
            );
            expect(queryResponseCache.add).not.toHaveBeenCalled();
            done();
          }
        );
    });

    it('should cache 200 response', (done) => {
      spyOn(FhirBatchQuery.prototype, 'get').and.resolveTo(
        responseFromFhirBatchQuery
      );
      FhirBatchQuery.prototype
        .getWithCache('some_url', { cacheErrors: true })
        .then((response) => {
          expect(response?.status).toBe(200);
          expect(FhirBatchQuery.prototype.get).toHaveBeenCalledWith(
            'full_url',
            {
              combine: true,
              cacheName: null,
              retryCount: 3,
              cacheErrors: true,
              cacheAbort: false,
              priority: PRIORITIES.NORMAL
            }
          );
          expect(queryResponseCache.add).toHaveBeenCalled();
          done();
        });
    });
  });
});

describe('FhirBatchQuery', () => {
  let fhirBatchQuery;
  let server: MockXhrServer;

  beforeEach(() => {
    server = newServer({
      post: [
        /http:\/\/some-server-url\/\?_format=json/,
        {
          status: HTTP_ABORT,
          body: '{ "message": "Abort!" }'
        }
      ],
      get: [
        /http:\/\/some-server-url\/someUrl[123]\?_format=json/,
        {
          // status: 200 is the default
          body: '{ "message": "Success!" }'
        }
      ]
    });
    server.get(/http:\/\/some-server-url\/someUrl4\?_format=json/, {
      status: 500,
      body: '{ "message": "Failure!" }'
    });

    server.install();
    fhirBatchQuery = new FhirBatchQuery({
      serviceBaseUrl: 'http://some-server-url'
    });
    // There are no preflight requests during the test
    fhirBatchQuery._maxTimeForPreflightRequest = 0;
    fhirBatchQuery._features = {isFormatSupported: true};
  });

  afterEach(() => {
    FhirBatchQuery.clearCache();
    server.remove();
  });

  it('should resend requests separately if batch request fails', (done) => {
    spyOn(fhirBatchQuery, 'dispatchEvent');
    Promise.allSettled([
      fhirBatchQuery.getWithCache('someUrl1'),
      fhirBatchQuery.getWithCache('someUrl2'),
      fhirBatchQuery.getWithCache('someUrl3')
    ]).then((responses) => {
      responses.forEach((response) =>
        expect(response.status).toBe('fulfilled')
      );
      expect(fhirBatchQuery.dispatchEvent).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ type: 'batch-issue' })
      );
      expect(server.getRequestLog()).toEqual([
        jasmine.objectContaining({
          method: 'POST',
          url: 'http://some-server-url/?_format=json',
          body: jasmine.stringMatching(/someUrl1.*someUrl2.*someUrl3/)
        }),
        jasmine.objectContaining({
          method: 'GET',
          url: 'http://some-server-url/someUrl1?_format=json'
        }),
        jasmine.objectContaining({
          method: 'GET',
          url: 'http://some-server-url/someUrl2?_format=json'
        }),
        jasmine.objectContaining({
          method: 'GET',
          url: 'http://some-server-url/someUrl3?_format=json'
        })
      ]);
      done();
    });
  });

  it('should emit single request failure events', (done) => {
    spyOn(fhirBatchQuery, 'dispatchEvent');
    Promise.allSettled([
      fhirBatchQuery.get('someUrl3', { combine: false }),
      fhirBatchQuery.get('someUrl4', { combine: false })
    ]).then((responses) => {
      expect(fhirBatchQuery.dispatchEvent).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ type: 'single-request-failure' })
      );
      expect(server.getRequestLog()).toEqual([
        jasmine.objectContaining({
          method: 'GET',
          url: 'http://some-server-url/someUrl3?_format=json'
        }),
        jasmine.objectContaining({
          method: 'GET',
          url: 'http://some-server-url/someUrl4?_format=json'
        })
      ]);
      done();
    });
  });

  it('should send requests according to their priority', (done) => {
    Promise.allSettled([
      fhirBatchQuery.getWithCache('someUrl1', {
        combine: false,
        priority: PRIORITIES.LOW
      }),
      fhirBatchQuery.getWithCache('someUrl2', {
        combine: false,
        priority: PRIORITIES.LOW
      }),
      fhirBatchQuery.getWithCache('someUrl3', {
        combine: false,
        priority: PRIORITIES.NORMAL
      })
    ]).then((responses) => {
      responses.forEach((response) =>
        expect(response.status).toBe('fulfilled')
      );
      expect(server.getRequestLog()).toEqual([
        jasmine.objectContaining({
          method: 'GET',
          url: 'http://some-server-url/someUrl3?_format=json'
        }),
        jasmine.objectContaining({
          method: 'GET',
          url: 'http://some-server-url/someUrl1?_format=json'
        }),
        jasmine.objectContaining({
          method: 'GET',
          url: 'http://some-server-url/someUrl2?_format=json'
        })
      ]);
      done();
    });
  });

  it('should remake metadata query without _elements param if not supported by server', (done) => {
    server.get(/http:\/\/some-server-url\/metadata\?_elements=fhirVersion&_format=json/, {
      status: 400,
      body: JSON.stringify({error: {message: '_elements is not supported.'}})
    });
    server.get(/http:\/\/some-server-url\/metadata\?_format=json/, {
      status: 200,
      body: '{ "fhirVersion": "4.0.1" }'
    });
    server.get(/http:\/\/some-server-url\/[Observation|ResearchStudy].*/, {
      status: 200,
      body: JSON.stringify({ entry: [] })
    });
    fhirBatchQuery.makeInitializationCalls().then(() => {
      const metaDataQueries = server.getRequestLog().filter(l => l.url.startsWith('http://some-server-url/metadata'));
      expect(metaDataQueries).toEqual([
        jasmine.objectContaining({
          method: 'GET',
          url: 'http://some-server-url/metadata?_elements=fhirVersion&_format=json'
        }),
        jasmine.objectContaining({
          method: 'GET',
          url: 'http://some-server-url/metadata?_format=json'
        })
      ]);
      done();
    });
  });

  it('should reject initialization if metadata requires OAuth2', (done) => {
    server.get(/http:\/\/some-server-url\/metadata.*/, {
      status: 401,
      body: '{ "message": "Not authorized!" }',
      headers: {'Www-Authenticate': 'Bearer bla bla'}
    });
    fhirBatchQuery.makeInitializationCalls().then(() => {
    }, (reason) => {
      expect(reason).toEqual({
        status: OAUTH2_REQUIRED, error: 'oauth2 required'
      })
      expect(server.getRequestLog()).toEqual([
        jasmine.objectContaining({
          method: 'GET',
          url: 'http://some-server-url/metadata?_elements=fhirVersion&_format=json'
        })
      ]);
      done();
    });
  });

  it('should reject initialization if ResearchStudy requires OAuth2', (done) => {
    server.get(/http:\/\/some-server-url\/metadata.*/, {
      status: 200,
      body: '{ "fhirVersion": "4.0.1" }'
    });
    server.get(/http:\/\/some-server-url\/ResearchStudy.*/, {
      status: 401,
      body: '{ "message": "Not authorized!" }',
      headers: {'Www-Authenticate': 'Bearer bla bla'}
    });
    fhirBatchQuery.makeInitializationCalls().then(() => {
    }, (reason) => {
      expect(reason).toEqual({
        status: OAUTH2_REQUIRED, error: 'oauth2 required'
      })
      expect(server.getRequestLog()).toEqual([
        jasmine.objectContaining({
          method: 'GET',
          url: 'http://some-server-url/metadata?_elements=fhirVersion&_format=json'
        }),
        jasmine.objectContaining({
          method: 'GET',
          url: 'http://some-server-url/ResearchStudy?_elements=id&_count=1&_format=json'
        })
      ]);
      done();
    });
  });
});
