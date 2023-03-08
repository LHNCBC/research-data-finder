import { TestBed } from '@angular/core/testing';
import { CACHE_NAME, FhirBackendService } from './fhir-backend.service';
import { FhirBackendModule } from './fhir-backend.module';
import { FhirBatchQuery } from './fhir-batch-query';
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

describe('FhirBackendService', () => {
  let service: FhirBackendService;
  let httpClient: HttpClient;
  let defaultHttpXhrBackend: HttpXhrBackend;
  const responseFromDefaultBackend = new HttpResponse({
    status: 200,
    body: 'response from default backend'
  });
  const responseFromFhirBatchQuery = {
    status: 200,
    data: 'response from FhirBatchQuery'
  };
  const responseFromFhirBatchQueryCache = {
    status: 200,
    data: 'response from FhirBatchQuery cache'
  };
  const csvDefinitions = {
    Observation: {
      columnDescriptions: [],
      searchParameters: []
    }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FhirBackendModule, HttpClientModule]
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
    service.fhirClient._features = { batch: true, interpretation: true };
    service.settings = TestBed.inject(SettingsService);
    spyOn(service.settings, 'loadCsvDefinitions').and.returnValue(
      of(csvDefinitions)
    );
    spyOn(service.settings, 'getDbgapUrlPattern').and.returnValue(
      '^https://dbgap-api.ncbi.nlm.nih.gov/fhir'
    );
    spyOn(service, 'isDbgap').and.returnValue(false);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize FhirBatchQuery', async () => {
    await service.initializeFhirBatchQuery();
    expect(FhirBatchQuery.prototype.initialize).toHaveBeenCalledOnceWith('');
  });

  it('should add interpretation search parameter', (done) => {
    service.initializeFhirBatchQuery();
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
          cacheName: ''
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
          cacheName: ''
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
          combine: true
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
            cacheName: 'some-cache-name-https://lforms-fhir.nlm.nih.gov/baseR4'
          }
        );
        done();
      });
  });

  it('should use FhirService if SMART on FHIR', (done) => {
    service.smartConnectionSuccess = true;
    const fhirService = TestBed.inject(FhirService);
    const fhirClient = jasmine.createSpyObj('FhirClient', ['request']);
    const responseFromFhirClient = {
      entries: [],
      total: 0
    };
    fhirClient.request.and.resolveTo(responseFromFhirClient);
    spyOn(fhirService, 'getSmartConnection').and.returnValue(fhirClient);
    httpClient.get('$fhir/some_related_url').subscribe((response) => {
      expect(response).toBe(responseFromFhirClient);
      expect(defaultHttpXhrBackend.handle).not.toHaveBeenCalled();
      expect(fhirClient.request).toHaveBeenCalledWith({
        url: '/some_related_url',
        signal: jasmine.any(AbortSignal)
      });
      done();
    });
  });
});
