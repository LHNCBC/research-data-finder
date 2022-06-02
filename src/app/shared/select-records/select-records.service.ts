import { Injectable } from '@angular/core';
import Resource = fhir.Resource;
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import Bundle = fhir.Bundle;
import { catchError, map } from 'rxjs/operators';

interface SelectRecordState {
  // Indicates that data is loading
  loading: boolean;
  // Array of loaded resources
  resources: Resource[];
  // Next page URL
  nextBundleUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SelectRecordsService {
  constructor(private http: HttpClient) {}

  currentState: { [resourceType: string]: SelectRecordState } = {};
  resourceStream: { [resourceType: string]: Observable<Resource[]> } = {};

  /**
   * Loads the first page of resources of specified resource type.
   * @param resourceType - resource type
   * @param url - request URL.
   */
  loadFirstPage(resourceType: string, url: string): void {
    this.currentState[resourceType] = {
      loading: true,
      resources: [],
      nextBundleUrl: url
    };

    this.loadNextPage(resourceType);
  }

  /**
   * Loads the next page of resources of specified resource type.
   * @param resourceType - resource type
   */
  loadNextPage(resourceType): void {
    const currentState = this.currentState[resourceType];
    if (!currentState.nextBundleUrl) {
      return;
    }
    const url = currentState.nextBundleUrl;
    delete currentState.nextBundleUrl;

    currentState.loading = true;
    this.resourceStream[resourceType] = this.http.get(url).pipe(
      map((data: Bundle) => {
        currentState.resources = currentState.resources.concat(
          data.entry?.map((item) => item.resource) || []
        );

        currentState.nextBundleUrl =
          data.link.find((l) => l.relation === 'next')?.url || null;

        currentState.loading = false;
        return currentState.resources;
      }),
      catchError((error) => {
        currentState.nextBundleUrl = url;
        throw error;
      })
    );
  }

  /**
   * Loads variables for selected research studies.
   * @param selectedResearchStudies - array of selected research studies.
   * @param filters - filter values
   */
  loadVariables(selectedResearchStudies: Resource[], filters: any): void {
    const currentState = {
      loading: true,
      resources: [],
      progressValue: 0,
      totalRecords: 0
    };
    this.currentState['Variable'] = currentState;
    const dataFields = {
      display_name: 'display_name',
      study_id: 'study_id',
      dataset_id: 'dataset_id',
      class: 'loinc.CLASS',
      type: 'dbgv.type',
      unit: 'dbgv.unit'
    };

    const url = `https://clinicaltables.nlm.nih.gov/api/dbg_vars/v3/search`;

    const studyIds = selectedResearchStudies.map((r) => r.id /* + '*'*/);

    const query = [];
    if (studyIds.length) {
      query.push('study_id:(' + studyIds.join(' OR ') + ')');
    }
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        query.push(`${dataFields[key]}:${value}`);
      }
    });

    this.resourceStream['Variable'] = this.http
      .get(url, {
        params: {
          rec_type: 'dbgv',
          maxList: 50,
          has_loinc: true,
          df: Object.values(dataFields).join(','),
          terms: '',
          q: query.join(' AND ')
        }
      })
      .pipe(
        map((data: any) => {
          // TODO
          const total = data[0];
          const list = data[3];
          if (total && list) {
            list.forEach((item) => {
              const res = {
                resourceType: 'Variable'
              };
              Object.keys(dataFields).forEach((key, index) => {
                res[key] = item[index];
              });
              currentState.resources.push(res);
            });
          }
          currentState.loading = false;
          return currentState.resources;
        })
      );
  }
}
