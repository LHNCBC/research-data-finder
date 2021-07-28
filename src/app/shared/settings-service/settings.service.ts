/**
 * This file contains a service used to load settings and provide access
 * to those settings.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Config } from '../../types/settings';
import { FhirBackendService } from '../fhir-backend/fhir-backend.service';
import { get as getPropertyByPath } from 'lodash-es';
import json5 from 'json5';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private config: Config;

  constructor(
    private http: HttpClient,
    private fhirBackend: FhirBackendService
  ) {}

  /**
   * Loads settings from JSON file.
   */
  loadJsonConfig(): Observable<any> {
    return this.http
      .get('assets/settings.json5', {
        responseType: 'text',
        headers: new HttpHeaders({
          'Cache-Control': 'no-store, max-age=0'
        })
      })
      .pipe(
        tap((config) => {
          this.config = json5.parse(config);
          this.fhirBackend.settings = this;
          this.fhirBackend.initializeFhirBatchQuery();
        })
      );
  }

  /**
   * Returns a settings parameter for the current FHIR server by property path.
   */
  get(paramPath): any {
    const url = this.fhirBackend.serviceBaseUrl;
    return (
      getPropertyByPath(this.config, `customization['${url}'].${paramPath}`) ||
      getPropertyByPath(this.config, `default.${paramPath}`)
    );
  }
}
