/**
 * This file contains a service used to handle HTTP requests to the FHIR server.
 */
import { Injectable } from '@angular/core';
import {
  HttpBackend,
  HttpErrorResponse,
  HttpEvent,
  HttpRequest,
  HttpResponse,
  HttpXhrBackend
} from '@angular/common/http';
import { BehaviorSubject, Observable, Observer } from 'rxjs';
import { FhirBatchQuery } from '@legacy/js/common/fhir-batch-query';
import * as definitionsIndex from '@legacy/js/search-parameters/definitions/index.json';
import { FhirServerFeatures } from '../../types/fhir-server-features';
import { escapeStringForRegExp } from '../utils';

// RegExp to modify the URL of requests to the FHIR server.
// If the URL starts with the substring "$fhir", it will be replaced
// with the current URL of the FHIR REST API database.
const serviceBaseUrlRegExp = /^\$fhir/;

export enum ConnectionStatus {
  Pending = 0,
  Ready,
  Error
}

/**
 * This is a final HttpHandler which will dispatch the request via browser HTTP APIs
 * to a backend. Interceptors sit between the HttpClient interface and the
 * HttpBackend. When injected, HttpBackend dispatches requests directly to
 * the backend, without going through the interceptor chain.
 * The main function which handles HTTP requests is called "handle".
 */
@Injectable({
  providedIn: 'root'
})
export class FhirBackendService implements HttpBackend {
  // Whether the connection to server is initialized.
  initialized = new BehaviorSubject(ConnectionStatus.Pending);

  // FHIR REST API Service Base URL (https://www.hl7.org/fhir/http.html#root)
  set serviceBaseUrl(url: string) {
    if (this.serviceBaseUrl !== url) {
      this.initialized.next(ConnectionStatus.Pending);
      this.initializeFhirBatchQuery(url);
    }
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

  // An object describing the server features
  get features(): FhirServerFeatures {
    return this.fhirClient.getFeatures();
  }

  // Version name e.g. "R4"
  get currentVersion(): string {
    return this.fhirClient.getVersionName();
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
    let queryServer;
    if (window.URLSearchParams !== undefined) {
      const params = new URLSearchParams(window.location.search);
      queryServer = params.has('server')
        ? decodeURIComponent(params.get('server'))
        : null;
    } else {
      // IE does not support URLSearchParams
      const queryMatch = window.location.search.match(
        new RegExp('[?&]server=([^&]+)', 'i')
      );
      queryServer =
        queryMatch && queryMatch.length
          ? decodeURIComponent(queryMatch[1])
          : null;
    }
    const defaultServer = 'https://lforms-fhir.nlm.nih.gov/baseR4';
    this.fhirClient = new FhirBatchQuery({
      serviceBaseUrl: queryServer || defaultServer
    });
    this.initializeFhirBatchQuery();
  }

  /**
   * Initialize/reinitialize FhirBatchQuery instance
   * @param [serviceBaseUrl] - new FHIR REST API Service Base URL
   */
  initializeFhirBatchQuery(serviceBaseUrl: string = ''): void {
    this.fhirClient.initialize(serviceBaseUrl).then(
      () => this.initialized.next(ConnectionStatus.Ready),
      () => this.initialized.next(ConnectionStatus.Error)
    );
  }

  /**
   * Handles HTTP requests.
   * All requests which matched to serviceBaseUrlRegExp treated as requests
   * to the current FHIR server. GET requests to the FHIR server could be
   * combined into a batch. FhirBatchQuery from the old version of
   * Research Data Finder is used for that.
   */
  handle(request: HttpRequest<any>): Observable<HttpEvent<any>> {
    if (
      !serviceBaseUrlRegExp.test(request.url) &&
      !request.url.startsWith(this.serviceBaseUrl)
    ) {
      // If it is not a request to the FHIR server,
      // pass the request to the default Angular backend.
      return this.defaultBackend.handle(request);
    }

    const newUrl = request.url.replace(
      serviceBaseUrlRegExp,
      this.serviceBaseUrl
    );
    const serviceBaseUrlWithEndpoint = new RegExp(
      '^' + escapeStringForRegExp(this.serviceBaseUrl) + '\\/[^?]+'
    );
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
    return new Observable<HttpResponse<any>>(
      (observer: Observer<HttpResponse<any>>) => {
        this.fhirClient.initialize().then(() => {
          // Requests to the FHIR server without endpoint cannot be combined
          // into a batch request
          const options = { combine: serviceBaseUrlWithEndpoint.test(newUrl) };
          const promise = this.isCacheEnabled
            ? this.fhirClient.getWithCache(fullUrl, options)
            : this.fhirClient.get(fullUrl, options);

          promise.then(
            ({ status, data }) => {
              observer.next(
                new HttpResponse<any>({
                  status,
                  body: data,
                  url: fullUrl
                })
              );
              observer.complete();
            },
            ({ status, error }) =>
              observer.error(
                new HttpErrorResponse({
                  status,
                  error,
                  url: fullUrl
                })
              )
          );
        });
      }
    );
  }

  /**
   * Returns definitions of columns, search params, value sets for current FHIR version
   */
  getCurrentDefinitions(): any {
    const versionName = this.currentVersion;
    const definitions = definitionsIndex.configByVersionName[versionName];

    if (!definitions.initialized) {
      // Add default common column "id"
      Object.keys(definitions.resources).forEach((resourceType) => {
        definitions.resources[resourceType].columnDescriptions.unshift({
          types: ['string'],
          element: 'id',
          isArray: false
        });
      });

      // prepare definitions on first request
      const valueSets = definitions.valueSets;
      const valueSetMaps = (definitions.valueSetMaps = Object.keys(
        valueSets
      ).reduce((valueSetsMap, entityName) => {
        valueSetsMap[entityName] =
          typeof valueSets[entityName] === 'string'
            ? valueSets[entityName]
            : valueSets[entityName].reduce((entityMap, item) => {
                entityMap[item.code] = item.display;
                return entityMap;
              }, {});
        return valueSetsMap;
      }, {}));

      Object.keys(definitions.valueSetByPath).forEach((path) => {
        definitions.valueSetMapByPath[path] =
          valueSetMaps[definitions.valueSetByPath[path]];
        definitions.valueSetByPath[path] =
          valueSets[definitions.valueSetByPath[path]];
      });
      definitions.initialized = true;
    }

    return definitions;
  }
}
