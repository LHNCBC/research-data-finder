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
import { cloneDeep, get as getPropertyByPath } from 'lodash-es';
import json5 from 'json5';
import { csvStringToArray, getUrlParam } from '../utils';

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
                  rowType,
                  displayName,
                  hideShow,
                  type,
                  expression,
                  description
                ]
              ) => {
                if (resourceType) {
                  resourceDescription = definitions[resourceType] = {
                    columnDescriptions: [],
                    searchParameters: []
                  };
                } else if (rowType === 'search parameter') {
                  // Each search parameter described in the CSV file can be
                  // a combination of several corresponding specification
                  // parameters separated by commas.
                  const elements = element.split(',');
                  const types = type.split(',')
                  const param: any = {
                    element : elements.length > 1 ? elements : element,
                    displayName,
                    description,
                    visible: hideShow === 'show'
                  };
                  if (type) {
                    param.type = types.length > 1 ? types : type;
                  }
                  resourceDescription.searchParameters.push(param);
                } else if (rowType === 'column') {
                  resourceDescription.columnDescriptions.push({
                    element,
                    displayName,
                    types: type.split(','),
                    expression,
                    displayByDefault: hideShow === 'show',
                    description
                  });
                } else {
                  throw new Error(`Unexpected description type "${rowType}"`);
                }

                return definitions;
              },
              {}
            );

            return cloneDeep(this.csvFile2resourceDefinitions[filename]);
          })
        );
    } else {
      return of(cloneDeep(this.csvFile2resourceDefinitions[filename]));
    }
  }

  /**
   * Returns a settings parameter for the current FHIR server by property path.
   */
  get(paramPath, serverBaseUrl = null): any {
    const url = serverBaseUrl || this.fhirBackend.serviceBaseUrl;
    // Treat https://dbgap-api.ncbi.nlm.nih.gov/fhir* as a dbGap server (at least for now).
    return this.fhirBackend.isDbgap(url)
      ? getPropertyByPath(this.config, `customization.dbgap.${paramPath}`) ??
      getPropertyByPath(
        this.config,
        `default_${this.fhirBackend.currentVersion}.${paramPath}`
      ) ??
      getPropertyByPath(this.config, `default.${paramPath}`)
      : getPropertyByPath(
        this.config,
        `customization['${url}'].${paramPath}`
      ) ??
      getPropertyByPath(
        this.config,
        `default_${this.fhirBackend.currentVersion}.${paramPath}`
      ) ??
      getPropertyByPath(this.config, `default.${paramPath}`);
  }

  /**
   * Returns the URL pattern for dbGap from config.
   */
  getDbgapUrlPattern(): string {
    return this.config.customization.dbgap.urlPattern;
  }

  /**
   * Returns the value used to initialize the "FHIR server" field in
   * the "Settings" step.
   */
  getDefaultServerUrl() {
    return this.config?.default?.allowChangeServer && getUrlParam('server') ||
      this.config?.default?.defaultServer;
  }

}
