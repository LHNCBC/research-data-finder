/**
 * This file contains a service used to load settings and provide access
 * to those settings.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Config } from '../../types/settings';
import { FhirBackendService } from '../fhir-backend/fhir-backend.service';
import { get as getPropertyByPath } from 'lodash-es';
import json5 from 'json5';
import { csvStringToArray } from '../utils';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private config: Config;
  private csvFile2resourceDefinitions: { [filename: string]: any } = {};

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
          if (!this.fhirBackend.smartConnectionSuccess) {
            this.fhirBackend.initializeFhirBatchQuery(this.fhirBackend.serviceBaseUrl);
          }
        })
      );
  }

  /**
   * Loads definitions by service base URL from CSV file.
   */
  loadCsvDefinitions(): Observable<{
    [resourceName: string]: {
      columnDescriptions: any[];
      searchParameters: any[];
    };
  }> {
    const filename = this.get('definitionsFile');
    if (filename && !this.csvFile2resourceDefinitions[filename]) {
      return this.http
        .get('conf/csv/' + filename, {
          responseType: 'text',
          headers: new HttpHeaders({
            'Cache-Control': 'no-store, max-age=0'
          })
        })
        .pipe(
          map((data) => {
            const csvData = csvStringToArray(data);
            if (!csvData) {
              throw new Error(`Can't parse "conf/csv/${filename}"`);
            }
            let resourceDescription;
            this.csvFile2resourceDefinitions[filename] = csvData.reduce(
              (
                definitions,
                [
                  resourceType,
                  element,
                  type,
                  displayName,
                  hideShow,
                  types,
                  expression,
                  description
                ]
              ) => {
                if (resourceType) {
                  resourceDescription = definitions[resourceType] = {
                    columnDescriptions: [],
                    searchParameters: []
                  };
                } else if (type === 'search parameter') {
                  const param: any = {
                    element,
                    displayName,
                    description
                  };
                  if (types) {
                    param.type = types;
                  }
                  resourceDescription.searchParameters.push(param);
                } else if (type === 'column') {
                  resourceDescription.columnDescriptions.push({
                    element,
                    displayName,
                    types: types.split(','),
                    expression,
                    displayByDefault: hideShow === 'show',
                    description
                  });
                } else {
                  throw new Error(`Unexpected description type "${type}"`);
                }

                return definitions;
              },
              {}
            );

            return this.csvFile2resourceDefinitions[filename];
          })
        );
    } else {
      return of(this.csvFile2resourceDefinitions[filename]);
    }
  }

  /**
   * Returns a settings parameter for the current FHIR server by property path.
   */
  get(paramPath): any {
    const url = this.fhirBackend.serviceBaseUrl;
    // Treat https://dbgap-api.ncbi.nlm.nih.gov/fhir* as a dbGap server (at least for now).
    return this.fhirBackend.isDbgap(url)
      ? getPropertyByPath(this.config, `customization.dbgap.${paramPath}`) ||
          getPropertyByPath(
            this.config,
            `default_${this.fhirBackend.currentVersion}.${paramPath}`
          ) ||
          getPropertyByPath(this.config, `default.${paramPath}`)
      : getPropertyByPath(
          this.config,
          `customization['${url}'].${paramPath}`
        ) ||
          getPropertyByPath(
            this.config,
            `default_${this.fhirBackend.currentVersion}.${paramPath}`
          ) ||
          getPropertyByPath(this.config, `default.${paramPath}`);
  }

  /**
   * Returns the URL pattern for dbGap from config.
   */
  getDbgapUrlPattern(): string {
    return this.config.customization.dbgap.urlPattern;
  }
}
