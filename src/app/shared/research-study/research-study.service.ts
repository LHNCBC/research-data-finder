import { Injectable } from '@angular/core';
import { expand, finalize, map, startWith } from 'rxjs/operators';
import { getNextPageUrl } from '../utils';
import { EMPTY, Observable } from 'rxjs';
import Bundle = fhir.Bundle;
import { HttpClient } from '@angular/common/http';
import Resource = fhir.Resource;

interface CurrentState {
  resources: Resource[];
  loading: boolean;
  progressValue: number;
  totalRecords: number;
  loadedRecords: number;
  myStudyIds: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ResearchStudyService {
  constructor(private http: HttpClient) {}
  currentState: CurrentState;

  /**
   * Calls server for a bundle of ResearchStudy resources.
   * Will recursively load resources if having next bundle.
   * @param url - request URL.
   * @param myStudiesOnly - whether it's loading only studies that user has access to.
   */
  loadResearchStudies(
    url: string,
    myStudiesOnly = false
  ): Observable<Resource[]> {
    const currentState: CurrentState = {
      resources: [],
      loading: true,
      progressValue: 0,
      totalRecords: 0,
      loadedRecords: 0,
      myStudyIds: []
    };
    this.currentState = currentState;
    return this.http.get(url).pipe(
      expand((response: Bundle) => {
        const nextPageUrl = getNextPageUrl(response);
        if (!nextPageUrl) {
          // Emit a complete notification if there is no next page
          return EMPTY;
        }
        return this.http.get<Bundle>(nextPageUrl);
      }),
      map((data: Bundle) => {
        if (data.total) {
          currentState.totalRecords = data.total;
        }
        currentState.loadedRecords += data.entry?.length || 0;
        data.entry?.forEach((item) => {
          currentState.resources.push(item.resource);
          if (myStudiesOnly) {
            currentState.myStudyIds.push(item.resource.id);
          }
        });
        if (currentState.totalRecords) {
          currentState.progressValue =
            (100 * currentState.loadedRecords) / currentState.totalRecords;
        }

        return [...currentState.resources];
      }),
      finalize(() => {
        currentState.loading = false;
      }),
      startWith([])
    );
  }
}
