import { Injectable } from '@angular/core';
import { expand, finalize, map, startWith } from 'rxjs/operators';
import { getNextPageUrl } from '../utils';
import { EMPTY, Observable } from 'rxjs';
import Bundle = fhir.Bundle;
import { HttpClient } from '@angular/common/http';
import Resource = fhir.Resource;
import {FhirBackendService} from "../fhir-backend/fhir-backend.service";

interface ResearchStudyState {
  // Indicates that data is loading
  loading: boolean;
  // Array of loaded studies
  resources: Resource[];
  // Resource loading progress value
  progressValue: number;
  // Total number of records
  totalRecords: number;
  // Number of loaded records
  loadedRecords: number;
  // Study IDs to which the user has access
  myStudyIds: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ResearchStudyService {
  constructor(private http: HttpClient,
              private fhirBackend: FhirBackendService) {}
  currentState: ResearchStudyState;

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
    const currentState: ResearchStudyState = {
      resources: [],
      loading: true,
      progressValue: 0,
      totalRecords: 0,
      loadedRecords: 0,
      myStudyIds: this.currentState?.myStudyIds || []
    };
    this.currentState = currentState;
    return this.http.get(url).pipe(
      expand((response: Bundle) => {
        let nextPageUrl = getNextPageUrl(response);
        if (!nextPageUrl) {
          // Emit a complete notification if there is no next page
          return EMPTY;
        }
        // Workaround for LF2383.
        if (nextPageUrl.startsWith('http:') && this.fhirBackend.serviceBaseUrl.startsWith('https:')) {
          nextPageUrl = nextPageUrl.replace('http:', 'https:');
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
