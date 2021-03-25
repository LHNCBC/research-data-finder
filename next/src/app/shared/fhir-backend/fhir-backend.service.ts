import { Injectable } from '@angular/core';
import {
  HttpBackend, HttpErrorResponse,
  HttpEvent,
  HttpRequest, HttpResponse,
  HttpXhrBackend
} from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  Observer
} from 'rxjs';
import { FhirBatchQuery } from './fhir-batch-query';

// RegExp to modify the URL of requests to the FHIR server.
// If the URL starts with the substring "$fhir", it will be replaced
// with the current URL of the FHIR REST API database.
const serviceBaseUrlRegExp = /^\$fhir/;

/**
 * This is a final HttpHandler which will dispatch the request via browser HTTP APIs
 * to a backend. Interceptors sit between the HttpClient interface and the
 * HttpBackend. When injected, HttpBackend dispatches requests directly to
 * the backend, without going through the interceptor chain.
 * The main function which handles HTTP requests is called "handle".
 */
@Injectable()
export class FhirBackendService implements HttpBackend {
  // Whether the connection to server is initialized.
  initialized$ = new BehaviorSubject(false);

  // FHIR REST API Service Base URL (https://www.hl7.org/fhir/http.html#root)
  set serviceBaseUrl(url: string) {
    this.initialized$.next(false);
    this.fhirClient.initialize(url).then(() => {
      this.initialized$.next(true);
    });
  }
  get serviceBaseUrl(): string {
    return this.fhirClient.getServiceBaseUrl();
  }

  // Maximum number of requests that can be combined
  set maxRequestsPerBatch(value: number) {
    this.fhirClient.setMaxRequestsPerBatch(value);
  }
  get maxRequestsPerBatch(): number {
    return this.fhirClient.getMaxRequestsPerBatch();
  }

  // Maximum number of requests that can be executed simultaneously
  set maxActiveRequests(val: number) {
    this.fhirClient.setMaxActiveRequests(val);
  }
  get maxActiveRequests(): number {
    return this.fhirClient.getMaxActiveRequests();
  }

  // NCBI E-utilities API Key.
  // See https://ncbiinsights.ncbi.nlm.nih.gov/2017/11/02/new-api-keys-for-the-e-utilities/
  set apiKey(val: string) {
    this.fhirClient.setApiKey(val);
  }
  get apiKey(): string {
    return this.fhirClient.getApiKey();
  }

  // Whether to cache requests to the FHIR server
  private isCacheEnabled = true;

  set cacheEnabled(value: boolean) {
    this.isCacheEnabled = value;
    if (!value) {
      FhirBatchQuery.clearCache();
    }
  }
  get cacheEnabled(): boolean {
    return this.isCacheEnabled;
  }

  // Javascript client from the old version of Research Data Finder
  // for FHIR with the ability to automatically combine requests in a batch .
  fhirClient: FhirBatchQuery;

  /**
   * Creates and initializes an instance of FhirBackendService
   * @param defaultBackend - default Angular final HttpHandler which uses
   *   XMLHttpRequest to send requests to a backend server.
   */
  constructor(private defaultBackend: HttpXhrBackend) {
    this.fhirClient = new FhirBatchQuery({
      serviceBaseUrl: 'https://lforms-fhir.nlm.nih.gov/baseR4'
    });
    this.fhirClient.initialize().then(() => {
      this.initialized$.next(true);
    });
  }

  /**
   * Handles HTTP requests.
   * All requests which matched to serviceBaseUrlRegExp treated as requests
   * to the current FHIR server. GET requests to the FHIR server could be
   * combined into a batch. FhirBatchQuery from the old version of
   * Research Data Finder is used for that.
   */
  handle(request: HttpRequest<any>): Observable<HttpEvent<any>> {
    if (!serviceBaseUrlRegExp.test(request.url)) {
      // If it is not a request to the FHIR server,
      // pass the request to the default Angular backend.
      return this.defaultBackend.handle(request);
    }

    const newUrl = request.url.replace(serviceBaseUrlRegExp, this.serviceBaseUrl);
    const newRequest = request.clone({
      url: newUrl
    });

    if (request.method !== 'GET') {
      // If it is not a GET request to the FHIR server,
      // pass the request to the default Angular backend.
      return this.defaultBackend.handle(newRequest);
    }

    const fullUrl = newRequest.urlWithParams;

    // Otherwise, use the FhirBatchQuery from the old version of
    // Research Data Finder to handle the HTTP request.
    return new Observable<HttpResponse<any>>((observer: Observer<HttpResponse<any>>) => {
      this.fhirClient.initialize().then(() => {
        const promise = this.isCacheEnabled
          ? this.fhirClient.getWithCache(fullUrl)
          : this.fhirClient.get(fullUrl);

        promise.then(
          ({status, data}) => {
            observer.next(new HttpResponse<any>({
              status,
              body: data,
              url: fullUrl
            }));
            observer.complete();
          },
          ({status, error}) => {
            observer.error(new HttpErrorResponse({
              status,
              error,
              url: fullUrl
            }));
          }
        );
      });
    });
  }
}
