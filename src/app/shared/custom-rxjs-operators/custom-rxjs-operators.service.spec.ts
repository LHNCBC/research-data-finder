import { TestBed } from '@angular/core/testing';

import { CustomRxjsOperatorsService } from './custom-rxjs-operators.service';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { HttpClient } from '@angular/common/http';

// Resource bundle pages used to mock responses
const bundlePages = {
  'page-1': {
    link: [
      {
        relation: 'next',
        url: 'page-2'
      }
    ],
    entry: [{ resource: { id: '1' } }, { resource: { id: '2' } }]
  },
  'page-2': {
    link: [
      {
        relation: 'next',
        url: 'page-3'
      }
    ],
    entry: [{ resource: { id: '3' } }, { resource: { id: '4' } }]
  },
  'page-3': {
    entry: [{ resource: { id: '5' } }, { resource: { id: '6' } }]
  }
};

describe('CustomRxjsOperatorsService', () => {
  let service: CustomRxjsOperatorsService;
  let mockHttp: HttpTestingController;
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
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
