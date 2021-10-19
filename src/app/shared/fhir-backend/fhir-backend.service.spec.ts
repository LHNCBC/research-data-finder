import { TestBed } from '@angular/core/testing';

import { FhirBackendService } from './fhir-backend.service';
import { FhirBackendModule } from './fhir-backend.module';
import { FhirBatchQuery } from '@legacy/js/common/fhir-batch-query';
import {
  HttpClient,
  HttpClientModule,
  HttpResponse,
  HttpXhrBackend
} from '@angular/common/http';
import { of } from 'rxjs';
import { SettingsService } from '../settings-service/settings.service';

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
    service = TestBed.inject(FhirBackendService);
    httpClient = TestBed.inject(HttpClient);
    defaultHttpXhrBackend = TestBed.inject(HttpXhrBackend);
    spyOn(defaultHttpXhrBackend, 'handle').and.returnValue(
      of(responseFromDefaultBackend)
    );
    service.fhirClient._features = { batch: true };
    service.settings = TestBed.inject(SettingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize FhirBatchQuery', () => {
    service.initializeFhirBatchQuery().subscribe();
    expect(FhirBatchQuery.prototype.initialize).toHaveBeenCalledOnceWith('');
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
          combine: true
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
          combine: false
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
          combine: true
        }
      );
      done();
    });
  });
});
