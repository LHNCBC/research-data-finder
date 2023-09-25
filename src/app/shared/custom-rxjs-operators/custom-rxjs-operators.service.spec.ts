import {TestBed} from '@angular/core/testing';
import {CustomRxjsOperatorsService} from './custom-rxjs-operators.service';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import {HttpClient, HttpContext} from '@angular/common/http';
import {CACHE_NAME, FhirBackendService} from '../fhir-backend/fhir-backend.service';

// Resource bundle pages used to mock responses
const bundlePages = {
  'page-1': {
    link: [
      {
        relation: 'next',
        url: 'page-2'
      }
    ],
    entry: [{resource: {id: '1'}}, {resource: {id: '2'}}]
  },
  'page-2': {
    link: [
      {
        relation: 'next',
        url: 'page-3'
      }
    ],
    entry: [{resource: {id: '3'}}, {resource: {id: '4'}}]
  },
  'page-3': {
    entry: [{resource: {id: '5'}}, {resource: {id: '6'}}]
  }
};

const mockFhirBackend = jasmine.createSpyObj('FhirBackendService', ['getNextPageUrl']);
mockFhirBackend.getNextPageUrl.and.callFake(function(response) {
  return response.link?.find((l) => l.relation === 'next')?.url || null;
});

describe('CustomRxjsOperatorsService', () => {
  let service: CustomRxjsOperatorsService;
  let mockHttp: HttpTestingController;
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{provide: FhirBackendService, useValue: mockFhirBackend}]
    });
    service = TestBed.inject(CustomRxjsOperatorsService);
    mockHttp = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('takeAllIf', () => {
    it('should not request the following sequence of resource bundle pages if the condition is false', () => {
      const next = jasmine.createSpy('next');
      const error = jasmine.createSpy('error');
      const complete = jasmine.createSpy('complete');

      http
        .get('page-1')
        .pipe(service.takeAllIf(false))
        .subscribe(next, error, complete);

      mockHttp.expectOne('page-1').flush(bundlePages['page-1']);

      expect(next).toHaveBeenCalledOnceWith(bundlePages['page-1']);
      expect(error).not.toHaveBeenCalled();
      expect(complete).toHaveBeenCalledTimes(1);
    });

    it('should request the following sequence of resource bundle pages', () => {
      const next = jasmine.createSpy('next');
      const error = jasmine.createSpy('error');
      const complete = jasmine.createSpy('complete');

      http
        .get('page-1')
        .pipe(service.takeAllIf(true))
        .subscribe(next, error, complete);

      mockHttp.expectOne('page-1').flush(bundlePages['page-1']);
      mockHttp.expectOne('page-2').flush(bundlePages['page-2']);
      mockHttp.expectOne('page-3').flush(bundlePages['page-3']);

      expect(next).toHaveBeenCalledOnceWith({
        link: undefined,
        entry: [].concat(
          bundlePages['page-1'].entry,
          bundlePages['page-2'].entry,
          bundlePages['page-3'].entry
        )
      });
      expect(error).not.toHaveBeenCalled();
      expect(complete).toHaveBeenCalledTimes(1);
    });

    it('should request the following sequence of resource bundle pages with CACHE_NAME', () => {
      const next = jasmine.createSpy('next');
      const error = jasmine.createSpy('error');
      const complete = jasmine.createSpy('complete');
      const someCacheName = 'someCacheName';
      const context = new HttpContext().set(CACHE_NAME, someCacheName);

      http
        .get('page-1', {context})
        .pipe(service.takeAllIf(true, {context}))
        .subscribe(next, error, complete);

      mockHttp
        .match((req) => {
          return (
            req.url === 'page-1' &&
            req.context.get(CACHE_NAME) === someCacheName
          );
        })[0]
        .flush(bundlePages['page-1']);
      mockHttp
        .match((req) => {
          return (
            req.url === 'page-2' &&
            req.context.get(CACHE_NAME) === someCacheName
          );
        })[0]
        .flush(bundlePages['page-2']);
      mockHttp
        .match((req) => {
          return (
            req.url === 'page-3' &&
            req.context.get(CACHE_NAME) === someCacheName
          );
        })[0]
        .flush(bundlePages['page-3']);

      expect(next).toHaveBeenCalledOnceWith({
        link: undefined,
        entry: [].concat(
          bundlePages['page-1'].entry,
          bundlePages['page-2'].entry,
          bundlePages['page-3'].entry
        )
      });
      expect(error).not.toHaveBeenCalled();
      expect(complete).toHaveBeenCalledTimes(1);
    });
  });

  describe('takeBundleOf', () => {
    it('should request the following sequence of resource bundle pages until the specified amount of resources is received', () => {
      const next = jasmine.createSpy('next');
      const error = jasmine.createSpy('error');
      const complete = jasmine.createSpy('complete');

      http
        .get('page-1')
        .pipe(service.takeBundleOf(3))
        .subscribe(next, error, complete);

      mockHttp.expectOne('page-1').flush(bundlePages['page-1']);

      mockHttp.expectOne('page-2').flush(bundlePages['page-2']);

      expect(next).toHaveBeenCalledOnceWith({
        link: bundlePages['page-2'].link,
        entry: []
          .concat(bundlePages['page-1'].entry, bundlePages['page-2'].entry)
          .slice(0, 3)
      });
      expect(error).not.toHaveBeenCalled();
      expect(complete).toHaveBeenCalledTimes(1);
    });
  });
});
