/**
 * This file contains a service used to load settings and provide access
 * to those settings.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Config } from '../../types/settings';
import { FhirBackendService } from '../fhir-backend/fhir-backend.service';
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
      .get('assets/settings.json5', { responseType: 'text' })
      .pipe(
        tap((config) => {
          this.config = json5.parse(config);
        })
      );
  }

  /**
   * Returns a settings parameter for the current FHIR server by name.
   */
  get(paramName): any {
    const url = this.fhirBackend.serviceBaseUrl;
    return (
      this.config?.customization?.[url]?.[paramName] ||
      this.config?.default?.[paramName]
    );
  }
}
