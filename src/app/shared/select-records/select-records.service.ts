/**
 * The file contains a service for loading and processing records in
 * the "Select records" and "Browse public data" steps.
 */
import { Injectable } from '@angular/core';
import Resource = fhir.Resource;
import {
  forkJoin,
  from,
  Observable,
  of,
  pipe,
  Subscription,
  UnaryFunction
} from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import Bundle = fhir.Bundle;
import {
  catchError,
  concatMap,
  finalize,
  map,
  shareReplay,
  startWith,
  switchMap
} from 'rxjs/operators';
import {
  escapeStringForRegExp,
  getNextPageUrl,
  modifyStringForSynonyms
} from '../utils';
import { Sort } from '@angular/material/sort';
import { CartService } from '../cart/cart.service';
import { HttpOptions } from '../../types/http-options';
import {
  CACHE_INFO,
  CACHE_NAME,
  FhirBackendService
} from '../fhir-backend/fhir-backend.service';
import { PullDataService } from '../pull-data/pull-data.service';
import { CohortService } from '../cohort/cohort.service';
import Observation = fhir.Observation;
import { ObservationCodeLookupComponent } from '../../modules/observation-code-lookup/observation-code-lookup.component';
import ResearchStudy = fhir.ResearchStudy;
import ResearchSubject = fhir.ResearchSubject;

type ResearchStudyMixin = { studyData?: ResearchStudy[] };

interface SelectRecordState {
  // Indicates that data is loading
  loading: boolean;
  // Array of loaded resources
  resources: (Resource & ResearchStudyMixin)[];
  // Whether result is cached
  isCached?: Observable<boolean>;
  // Time when the data was received from the server
  loadTime?: Date;
  // Next page URL for regular FHIR resources
  nextBundleUrl?: string;
  // Page number for CTSS variables
  currentPage?: number;
  // Indicates whether we need to reload data
  reset?: boolean;
  // The total number of records is used to determine whether the next page
  // of CTSS variables exists
  totalRecords?: number;
  // A set of processed observation codes when we build a list of variables from
  // observations
  processedObservationCodes?: Set<string>;
  // Observable for loading resources
  resourceStream?: Observable<Resource[]>;
  // Preload subscription
  preloadSubscription?: Subscription;
}

@Injectable({
  providedIn: 'root'
})
export class SelectRecordsService {
  constructor(
    private http: HttpClient,
    private cart: CartService,
    private pullData: PullDataService,
    private cohort: CohortService,
    private fhirBackend: FhirBackendService
  ) {}

  currentState: { [resourceType: string]: SelectRecordState } = {};
  preloadState: { [resourceType: string]: SelectRecordState } = {};

  /**
   * Resets the state of all resource types.
   */
  resetAll(): void {
    this.currentState = {};
    this.preloadState = {};
    this.cart.reset();
    this.cohort.resetCriteria();
    this.pullData.reset();
  }

  /**
   * Resets the state for the specified resource type
   * @param resourceType - resource type
   */
  resetState(resourceType: string): void {
    if (this.currentState[resourceType]) {
      // The easiest way is to delete the state, but in this case, the table
      // component will be recreated, which will lead to the image flickering.
      this.currentState[resourceType].reset = true;
    }
  }

  /**
   * Returns true if resource type records need to be reloaded.
   * @param resourceType - resource type
   */
  isNeedToReload(resourceType: string): boolean {
    return (
      !this.currentState[resourceType] || this.currentState[resourceType].reset
    );
  }

  /**
   * Loads the first page of resources of specified resource type.
   * @param resourceType - resource type
   * @param url - request URL.
   * @param options - the HTTP options to send with the request.
   */
  loadFirstPage(resourceType: string, url: string, options: HttpOptions): void {
    this.currentState[resourceType] = {
      loading: true,
      resources: [],
      nextBundleUrl: url
    };

    this.loadNextPage(resourceType, options);
  }

  /**
   * Loads the next page of resources of specified resource type.
   * @param resourceType - resource type
   * @param options - the HTTP options to send with the request.
   */
  loadNextPage(resourceType, options?: HttpOptions): void {
    const currentState = this.currentState[resourceType];
    if (!currentState.nextBundleUrl) {
      return;
    }
    const url = currentState.nextBundleUrl;
    delete currentState.nextBundleUrl;

    currentState.loading = true;
    currentState.isCached = from(
      this.fhirBackend.isCached(url, options?.context?.get(CACHE_NAME))
    );
    currentState.resourceStream = this.http.get(url, options).pipe(
      map((data: Bundle) => {
        const cacheInfo = options?.context?.get(CACHE_INFO);
        currentState.loadTime = cacheInfo
          ? new Date(cacheInfo.timestamp)
          : new Date();

        currentState.resources = currentState.resources.concat(
          data.entry?.map((item) => item.resource) || []
        );
        currentState.nextBundleUrl = getNextPageUrl(data);
        return currentState.resources;
      }),
      catchError(() => {
        // Do not retry after an error
        currentState.nextBundleUrl = null;
        return of(currentState.resources);
      }),
      finalize(() => {
        currentState.loading = false;
      }),
      switchMap((resources: Resource[]) =>
        // Exclude records added to the cart from the list
        this.cart.getCartChanged(resourceType).pipe(
          startWith(resources),
          map(() =>
            resources.filter(
              (resource) => !this.cart.hasRecord(resourceType, resource)
            )
          )
        )
      ),
      startWith([])
    );
  }

  /**
   * Loads variables for selected research studies.
   * @param selectedResearchStudies - array of selected research studies.
   * @param params - http parameters
   * @param filters - filter values
   * @param sort - the current sort state
   * @param pageNumber - page number to load
   */
  loadVariables(
    selectedResearchStudies: Resource[],
    params: {
      [param: string]: any;
    },
    filters: any,
    sort: Sort,
    pageNumber: number
  ): void {
    const resourceType = 'Variable';
    let currentState;
    if (pageNumber === 0) {
      currentState = {
        loading: true,
        resources: [],
        currentPage: pageNumber,
        totalRecords: 0
      };
      this.currentState[resourceType] = currentState;
    } else {
      currentState = this.currentState[resourceType];
      if (
        currentState?.loading ||
        currentState?.totalRecords <= pageNumber * 50
      ) {
        return;
      }
      currentState.loading = true;
    }

    const dataFields = {
      id: 'uid',
      display_name: 'display_name',
      loinc_long_name: 'loinc.LONG_COMMON_NAME',
      loinc_short_name: 'loinc.SHORTNAME',
      loinc_num: 'loinc_num',
      study_id: 'study_id',
      study_name: 'study_name',
      dataset_id: 'dataset_id',
      dataset_name: 'dataset_name',
      class: 'loinc.CLASS',
      type: 'dbgv.type',
      unit: 'dbgv.unit'
    };

    const url = `https://clinicaltables.nlm.nih.gov/api/dbg_vars/v3/search`;

    const studyIds = selectedResearchStudies.map((r) => r.id + '*');

    const query = [];
    if (studyIds.length) {
      query.push('study_id:(' + studyIds.join(' OR ') + ')');
    }
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        if (key === 'display_name') {
          // Name for display is currently the LOINC short name or dbGap description.
          // To find synonyms, we extended the display name search by additionally
          // searching the long and short LOINC names.
          query.push(`(${dataFields[key]}:(${value}) OR synonyms:(${value}))`);
        } else {
          // Use wildcard search for below columns so user can filter by typing a prefix.
          ['id', 'study_id', 'dataset_id', 'type', 'unit'].includes(key)
            ? query.push(`${dataFields[key]}:(${value}*)`)
            : query.push(`${dataFields[key]}:(${value})`);
        }
      }
    });

    const uniqDataFields = [...new Set(Object.values(dataFields))];

    const httpParams = new HttpParams({
      fromObject: {
        offset: pageNumber * 50,
        count: 50,
        df: uniqDataFields.join(','),
        terms: '',
        q: query.join(' AND '),
        ...params,
        ...(sort
          ? {
              of:
                dataFields[sort.active] +
                ':' +
                // MatTable shows sort order icons in reverse (see comment to PR on LF-1905).
                (sort.direction === 'asc' ? 'desc' : 'asc')
            }
          : {})
      }
    });

    currentState.resourceStream = this.http
      .post(url, httpParams.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
      .pipe(
        map((data: any) => {
          const total = data[0];
          currentState.totalRecords = total;
          const list = data[3];
          if (total && list) {
            list.forEach((item) => {
              const res = {
                resourceType
              };
              const values = {};
              Object.keys(dataFields).forEach((key, index) => {
                values[uniqDataFields[index]] = item[index];
              });
              Object.entries(dataFields).forEach(([key, field]) => {
                res[key] = values[field];
              });
              currentState.resources.push(res);
            });
          }
          currentState.currentPage = pageNumber;
          return currentState.resources;
        }),
        catchError(() => {
          return of(currentState.resources);
        }),
        finalize(() => {
          currentState.loading = false;
        }),
        switchMap((resources: Resource[]) =>
          this.cart.getCartChanged(resourceType).pipe(
            startWith(resources),
            map(() =>
              resources.filter(
                (resource) => !this.cart.hasRecord(resourceType, resource)
              )
            )
          )
        )
      );
  }

  // Loading is complete and there is data in the table
  getHasLoadedData(resourceType: string): boolean {
    return (
      !this.currentState[resourceType]?.loading &&
      this.currentState[resourceType]?.resources.length > 0
    );
  }

  /**
   * Loads the first page of the list of variables for the selected studies
   * from observations.
   * @param selectedResearchStudies - array of selected research studies.
   * @param params - http parameters.
   * @param filters - filter values.
   * @param sort - the current sort state.
   */
  loadFirstPageOfVariablesFromObservations(
    selectedResearchStudies: Resource[],
    params: {
      [param: string]: any;
    },
    filters: any,
    sort: Sort
  ) {
    const resourceType = 'Observation';
    const state = {
      loading: true,
      resources: [],
      processedObservationCodes: new Set<string>(),
      totalRecords: 0
    };
    this.currentState[resourceType] = state;
    this.preloadState[resourceType]?.preloadSubscription.unsubscribe();
    delete this.preloadState[resourceType];

    this.loadVariablesFromObservations(
      state,
      selectedResearchStudies,
      params,
      filters,
      sort,
      true
    );
  }

  /**
   * Loads the next page of the list of variables for the selected studies
   * from observations.
   * @param selectedResearchStudies - array of selected research studies.
   * @param params - http parameters.
   * @param filters - filter values.
   * @param sort - the current sort state.
   */
  loadNextPageOfVariablesFromObservations(
    selectedResearchStudies: Resource[],
    params: {
      [param: string]: any;
    },
    filters: any,
    sort: Sort
  ) {
    const resourceType = 'Observation';
    if (this.preloadState[resourceType]) {
      this.currentState[resourceType] = this.preloadState[resourceType];
      delete this.preloadState[resourceType];
    } else {
      const state = this.currentState[resourceType];
      if (state.loading || !state.nextBundleUrl) {
        return;
      }
      state.loading = true;

      this.loadVariablesFromObservations(
        state,
        selectedResearchStudies,
        params,
        filters,
        sort,
        false
      );
    }
  }

  /**
   * Preloads the next page of the list of variables for the selected studies
   * from observations.
   * @param selectedResearchStudies - array of selected research studies.
   * @param params - http parameters.
   * @param filters - filter values.
   * @param sort - the current sort state.
   */
  preloadNextPageOfVariablesFromObservations(
    selectedResearchStudies: Resource[],
    params: {
      [param: string]: any;
    },
    filters: any,
    sort: Sort
  ) {
    const resourceType = 'Observation';
    const currentState = this.currentState[resourceType];
    const preloadState = this.preloadState[resourceType];
    let state = preloadState || currentState;
    if (!state || state.loading || !state.nextBundleUrl) {
      return;
    }
    if (!preloadState) {
      state = {
        ...currentState
      };
      this.preloadState[resourceType] = state;
    }

    state.loading = true;

    state.preloadSubscription = this.loadVariablesFromObservations(
      state, selectedResearchStudies, params, filters, sort, false
    ).subscribe(() => {});
  }

  /**
   * Loads a list of variables for selected research studies from observations.
   * @param state - the state of the observation records loading process.
   * @param selectedResearchStudies - array of selected research studies.
   * @param params - http parameters
   * @param filters - filter values
   * @param sort - the current sort state
   * @param reset - whether to reset already loaded data
   * @return an Observable of an array of variables
   */
  loadVariablesFromObservations(
    state: SelectRecordState,
    selectedResearchStudies: Resource[],
    params: {
      [param: string]: any;
    },
    filters: any,
    sort: Sort,
    reset: boolean
  ): Observable<Resource[]> {
    const resourceType = 'Observation';

    // Observation filter parameters
    const obsFilterParams = {
      ...(filters.code
        ? {
            'code:text': modifyStringForSynonyms(
              ObservationCodeLookupComponent.wordSynonymsLookup,
              filters.code
            )
          }
        : {}),
      ...(filters.code_value
        ? {
            code: filters.code_value
          }
        : {}),
      ...(filters.category
        ? {
            'category:text': modifyStringForSynonyms(
              ObservationCodeLookupComponent.wordSynonymsLookup,
              filters.category
            )
          }
        : {}),
      ...(state.processedObservationCodes.size
        ? {
            'code:not': this.fhirBackend.features.hasNotModifierIssue
              ? // Pass a single "code:not" parameter, which is currently working
                // correctly on the HAPI FHIR server.
                Array.from<string>(state.processedObservationCodes.keys()).join(',')
              : // Pass each code as a separate "code:not" parameter, which is
                // currently causing performance issues on the HAPI FHIR server.
                Array.from<string>(state.processedObservationCodes.keys())
          }
        : {})
    };

    // When we use lastn we get only 499 Variables.
    // const lastnLookup =
    //   this.fhirBackend.features.lastnLookup && !references.length;
    const lastnLookup = false;
    const url = lastnLookup
      ? reset
        ? '$fhir/Observation/$lastn?max=1'
        : state.nextBundleUrl
      : '$fhir/Observation';

    const reqParams =
      lastnLookup && !reset
        ? {}
        : {
            _elements: 'code,value,category',
            // TODO: Currently, we can't link Observations to ResearchStudies
            //   through a search parameter. That may be possible in R5. See:
            //   https://build.fhir.org/extension-workflow-researchstudy.html
            //   https://chat.fhir.org/#narrow/stream/179166-implementers/topic/Link.20ObservationDefinition.20to.20ResearchStudy.3F/near/316394306
            ...obsFilterParams,
            _count: 50
          };

    const studies =
      (this.currentState['ResearchStudy']
        ?.resources as ResearchStudy[])?.reduce((acc, study) => {
        acc[study.id] = study;
        return acc;
      }, {}) || {};

    state.resourceStream = this.http.get(url, { params: reqParams }).pipe(
      this.filterObservationsByCode(
        state,
        studies,
        // Patient filter parameters used to check an observation code
        selectedResearchStudies.length
          ? {
              [`_has:ResearchSubject:${this.fhirBackend.subjectParamName}:study`]: selectedResearchStudies
                .map((s) => 'ResearchStudy/' + s.id)
                .join(','),
              _revinclude: 'ResearchSubject:subject'
            }
          : this.fhirBackend.features.hasAvailableStudy
          ? {
              [`_has:ResearchSubject:${this.fhirBackend.subjectParamName}:status`]: Object.keys(
                this.fhirBackend.getCurrentDefinitions().valueSetMapByPath[
                  'ResearchSubject.status'
                ]
              ).join(','),
              _revinclude: 'ResearchSubject:subject'
            }
          : null
      ),
      this.convertObservationToVariableRecords(state, obsFilterParams),
      catchError(() => {
        // Do not retry after an error
        state.nextBundleUrl = null;
        return of(state.resources);
      }),
      finalize(() => {
        state.loading = false;
      }),
      switchMap((resources: Resource[]) =>
        // Exclude records added to the cart from the list
        this.cart.getCartChanged(resourceType).pipe(
          startWith(resources),
          map(() =>
            resources.filter(
              (resource) => !this.cart.hasRecord(resourceType, resource)
            )
          )
        )
      ),
      // startWith(currentState.resources)
      shareReplay()
    );
    return state.resourceStream;
  }

  /**
   * RxJS operator to filter observations by code:
   * - excludes observation with repeated codes
   * - excludes codes that do not exist for patients who meet the specified
   *   filter criteria
   * @param state - current state
   * @param studies - studies available to the user
   * @param patientFilters - patient filters specify criteria for studies
   */
  filterObservationsByCode(
    state: SelectRecordState,
    studies: { [id: string]: ResearchStudy },
    patientFilters: { [param: string]: string }
  ): UnaryFunction<Observable<Bundle>, Observable<Observation[]>> {
    return pipe(
      concatMap((data: Bundle) => {
        const checkRequests = data.entry.reduce((requests, entry) => {
          const obs: Observation & ResearchStudyMixin = {
            ...(entry.resource as Observation),
            studyData: []
          };
          const coding = obs.code.coding?.[0];
          const codeAndSystem = coding
            ? coding.system + '|' + coding.code
            : null;
          const isNew =
            codeAndSystem &&
            !state.processedObservationCodes.has(codeAndSystem);
          if (isNew) {
            state.processedObservationCodes.add(codeAndSystem);
            requests.push(
              patientFilters
                ? this.http
                    .get('$fhir/Patient', {
                      params: {
                        '_has:Observation:subject:code': codeAndSystem,
                        ...patientFilters,
                        _elements: 'id',
                        _count: 1
                      }
                    })
                    .pipe(
                      map((checkResponse: Bundle) => {
                        const entries = checkResponse.entry;
                        for (let i = 1; i < entries?.length; i++) {
                          const subject = entries[i]
                            .resource as ResearchSubject;
                          const studyId = subject.study?.reference
                            .split('/')
                            .pop();
                          const study = studies[studyId];
                          if (study) {
                            obs.studyData.push(study);
                          }
                        }
                        return checkResponse.entry?.length ? obs : null;
                      })
                    )
                : of(obs)
            );
          }
          return requests;
        }, []);
        state.nextBundleUrl = getNextPageUrl(data);
        return checkRequests.length === 0
          ? of([])
          : forkJoin(checkRequests).pipe(
              map((observations: Observation[]) =>
                observations.filter((obs) => !!obs)
              )
            );
      })
    );
  }

  /**
   * RxJS operator to converts an array of observations to an array of variable
   * records:
   * - creates a variable record for each code in each observation
   * - exclude codes that don't match filter parameters
   * @param state - current state
   * @param obsFilterParams - observation filter parameters
   */
  convertObservationToVariableRecords(
    state: SelectRecordState,
    obsFilterParams: { [param: string]: string | string[] }
  ): UnaryFunction<Observable<Observation[]>, Observable<Resource[]>> {
    return pipe(
      map((observations: Observation[]) => {
        const reCodeText = obsFilterParams['code:text']
          ? new RegExp(
              '(' +
                (obsFilterParams['code:text'] as string)
                  .split(',')
                  .map((str) => escapeStringForRegExp(str))
                  .join('|') +
                ')',
              'i'
            )
          : null;
        const allowedCodes = (obsFilterParams.code as string)
          ?.trim()
          .split(/\s*,\s*/)
          .filter((code) => code)
          .reduce((acc, code) => {
            acc.add(code.trim());
            return acc;
          }, new Set<string>());

        state.resources = state.resources.concat(
          ...observations.map((obs) => {
            return (
              obs.code.coding
                .filter((coding) => {
                  // Exclude codes that don't match filters
                  return (
                    (!allowedCodes?.size || allowedCodes.has(coding.code)) &&
                    (!reCodeText || reCodeText.test(coding.display))
                  );
                })
                // Create a variable record for each code
                .map((coding) => ({
                  ...obs,
                  // Replace observation ID with code and system, this ID is
                  // used for identify variable in cart
                  id: coding.system + '|' + coding.code,
                  code: {
                    coding: [coding]
                  }
                }))
            );
          })
        );

        return state.resources;
      })
    );
  }
}
