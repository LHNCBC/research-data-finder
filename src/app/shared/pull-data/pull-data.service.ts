/**
 * This file contains a service for pulling data for a cohort of patients.
 */
import { Injectable } from '@angular/core';
import {
  SelectedObservationCodes
} from '../../types/selected-observation-codes';
import { Criteria, ResourceTypeCriteria } from '../../types/search-parameters';
import { CODETEXT } from '../query-params/query-params.service';
import { CohortService } from '../cohort/cohort.service';
import {
  concatMap,
  finalize,
  map,
  shareReplay,
  startWith,
  tap
} from 'rxjs/operators';
import { forkJoin, fromEvent, Observable, of } from 'rxjs';
import { chunk, differenceBy, uniqBy } from 'lodash-es';
import Patient = fhir.Patient;
import Resource = fhir.Resource;
import Bundle = fhir.Bundle;
import Observation = fhir.Observation;
import { HttpClient, HttpContext } from '@angular/common/http';
import { ColumnValuesService } from '../column-values/column-values.service';
import {
  FhirBackendService, NO_CACHE, REQUEST_PRIORITY, RequestPriorities
} from '../fhir-backend/fhir-backend.service';
import BundleEntry = fhir.BundleEntry;
import { CustomRxjsOperatorsService } from '../custom-rxjs-operators/custom-rxjs-operators.service';

type PatientMixin = { patientData?: Patient };

interface PullDataState {
  // Indicates that data is loading
  loading: boolean;
  // Array of loaded resources
  resources: (Resource & PatientMixin)[];
  // Array of unique loaded resources
  uniqueResources: Resource[];
  // Resource loading progress value
  progressValue: number;
  // Number of failed requests
  failedRequests?: number;
  startTime: number;
  loadedDateTime: number;
  loadTime: number;
}

@Injectable({
  providedIn: 'root'
})
export class PullDataService {
  constructor(
    private cohort: CohortService,
    private fhirBackend: FhirBackendService,
    private http: HttpClient,
    private columnValues: ColumnValuesService,
    private customRxjs: CustomRxjsOperatorsService
  ) {
    cohort.criteria$.subscribe(() => this.reset());
  }

  currentState: { [resourceType: string]: PullDataState } = {};
  // Stream of resources for ResourceTableComponent
  resourceStream: { [resourceType: string]: Observable<Resource[]> } = {};
  // Common HTTP options
  static get commonHttpOptions() {
    return {
      context: new HttpContext().set(REQUEST_PRIORITY, RequestPriorities.LOW).set(NO_CACHE, true)
    };
  }

  defaultObservationCodes$ = this.cohort.criteria$.pipe(
    map((criteria) =>
      this.combineObservationCodes(this.getObservationCodesFrom(criteria))
    )
  );
  /**
   * Combines the elements of the SelectedObservationCodes array into a single
   * SelectedObservationCodes object.
   */
  combineObservationCodes(
    observationCodeArray: SelectedObservationCodes[]
  ): SelectedObservationCodes {
    const codeCounts = observationCodeArray.reduce((res, observationCodeItem) => {
      observationCodeItem.items.forEach(item => {
        res[item] = res[item] ? res[item] + 1 : 1;
      });
      return res;
    }, {});
    return observationCodeArray.reduce(
      (result, cc) => {
        cc.items.forEach((item, index) => {
          result.items.push(codeCounts[item] > 1
            ? `${item} | ${cc.coding[index].code}` + (cc.coding[index].system ? ` | ${cc.coding[index].system}` : '')
            : item);
          result.coding.push(cc.coding[index]);
        });
        return result;
      },
      {
        coding: [],
        datatype: 'any',
        items: []
      }
    );
  }

  /**
   * Returns selected observation codes from specified criteria
   * @param criteria - criteria tree
   */
  private getObservationCodesFrom(
    criteria: Criteria | ResourceTypeCriteria
  ): SelectedObservationCodes[] {
    let codeFieldValues: SelectedObservationCodes[] = [];
    if ('resourceType' in criteria) {
      if (criteria.resourceType === 'Observation') {
        const foundRule = (criteria as ResourceTypeCriteria).rules.find(
          (rule) =>
            rule.field.element === CODETEXT &&
            rule.field.selectedObservationCodes
        );
        if (foundRule) {
          codeFieldValues.push(foundRule.field.selectedObservationCodes);
        }
      }
    } else {
      const length = criteria.rules.length;
      for (let i = 0; i < length; ++i) {
        codeFieldValues = codeFieldValues.concat(
          this.getObservationCodesFrom(criteria.rules[i])
        );
      }
    }

    return codeFieldValues;
  }

  /**
   * Resets all loaded data.
   */
  reset(): void {
    this.currentState = {};
    this.resourceStream = {};
  }

  /**
   * Resets data loaded for the specified resource type.
   * @param resourceType - resource type.
   */
  resetResourceData(resourceType: string): void {
    delete this.currentState[resourceType];
    delete this.resourceStream[resourceType];
  }

  /**
   * Loads resources of the specified type for a cohort of Patients.
   * @param resourceType - resource type
   * @param perPatientCount - numbers of resources to show per patient
   *   (for Observation resource type - per patient per test)
   * @param criteria - additional url parameter string
   * @param maxObservationToCheck - number of recent Observations per Patient to
   *   load when no code is specified in the criteria.
   */
  loadResources(
    resourceType: string,
    perPatientCount: number,
    criteria: string,
    maxObservationToCheck: number = 1000
  ): Observable<Resource[]> {
    const currentState: PullDataState = {
      loading: true,
      resources: [],
      uniqueResources: [],
      progressValue: 0,
      failedRequests: 0,
      startTime: Date.now(),
      loadedDateTime: 0,
      loadTime: 0
    };
    this.currentState[resourceType] = currentState;
    const subscription = fromEvent(
      this.fhirBackend.fhirClient,
      'single-request-failure'
    ).subscribe(() => {
      currentState.failedRequests++;
    });

    // For pulling EV, we first pull Observations and then retrieve EVs
    // by looking at Observation extensions.
    const resourceTypeParam =
      resourceType === 'EvidenceVariable' ? 'Observation' : resourceType;
    const observationCodes = [];
    const patientToCodeToCount = {};
    const patientEvCount = {};
    const evObservables = {};
    let sortParam = '';

    if (resourceTypeParam === 'Observation') {
      criteria = criteria.replace(/&combo-code=([^&]*)/g, (_, $1) => {
        observationCodes.push(...$1.split(','));
        return '';
      });

      const sortFields = observationCodes.length ? [] : ['code'];
      if (this.fhirBackend.features.sortObservationsByDate) {
        sortFields.push('-date');
      } else if (this.fhirBackend.features.sortObservationsByAgeAtEvent) {
        sortFields.push('-age-at-event');
      }
      sortParam = '&_sort=' + sortFields.join(',');
    }

    // To optimize Patient loading, we load them for 10 Patients
    // in one query. We don't use this optimization for other resource types
    // because we need to limit the number of resources per Patient.
    const numberOfPatientsInRequest = resourceType === 'Patient' ? 10 : 1;

    this.resourceStream[resourceType] = forkJoin(
      [].concat(
        ...chunk(
          this.cohort.currentState.patients,
          numberOfPatientsInRequest
        ).map((patients) => {
          let linkToPatient;

          if (resourceType === 'ResearchStudy') {
            linkToPatient = `_has:ResearchSubject:study:${
              this.fhirBackend.subjectParamName
            }=${patients.map((patient) => patient.id).join(',')}`;
          } else if (resourceType === 'Patient') {
            linkToPatient = `_id=${patients
              .map((patient) => patient.id)
              .join(',')}`;
          } else {
            linkToPatient = `subject=${patients
              .map((patient) => 'Patient/' + patient.id)
              .join(',')}`;
          }

          let requests, count;

          if (observationCodes.length) {
            count = perPatientCount;
            // Create separate requests for each Observation code
            requests = observationCodes.map((code) => {
              return this.http.get(
                `$fhir/${resourceTypeParam}?${linkToPatient}${criteria}${sortParam}&_count=${count}&combo-code=${code}`,
                PullDataService.commonHttpOptions
              );
            });
          } else {
            count =
              resourceTypeParam === 'Observation'
                ? // When no code is specified in the criteria, we load the
                  // maxObservationToCheck of recent Observations.
                  maxObservationToCheck
                : perPatientCount;
            requests = [
              this.http.get(
                `$fhir/${resourceTypeParam}?${linkToPatient}${criteria}${sortParam}&_count=${count}`,
                PullDataService.commonHttpOptions
              )
            ];
          }

          return requests.map((req) =>
            req.pipe(
              this.customRxjs.takeBundleOf(count),
              concatMap((bundle: Bundle) => {
                if (resourceType === 'EvidenceVariable') {
                  return this.loadEvidenceVariables(
                    bundle,
                    patientEvCount,
                    evObservables,
                    perPatientCount
                  );
                } else if (resourceType === 'Observation') {
                  return this.processObservations(
                    observationCodes,
                    bundle,
                    patientToCodeToCount,
                    perPatientCount,
                    currentState
                  );
                }

                return of(bundle);
              }),
              map(this.prepareResponseData(resourceType, patients, currentState)),
              tap(
                this.updateProgressIndicator(
                  currentState,
                  numberOfPatientsInRequest,
                  observationCodes
                )
              )
            )
          );
        })
      )
    ).pipe(
      startWith([]),
      map((resources) => {
        // Reassign currentState.resources in correct order
        currentState.resources = [].concat(...resources);
        this.updateUniqueResources(resourceType, currentState);
        return currentState.resources;
      }),
      finalize(() => {
        currentState.progressValue = 100;
        currentState.loading = false;
        currentState.loadedDateTime = Date.now();
        currentState.loadTime = Math.round((currentState.loadedDateTime - currentState.startTime) / 100) / 10;
        subscription.unsubscribe();
      })
    );

    return this.resourceStream[resourceType];
  }

  /**
   * Updates the list of unique resources in the current state.
   * Currently only used for EvidenceVariables.
   * @param resourceType - resource type
   * @param currentState - the current state of pulling data.
   */
  updateUniqueResources(resourceType: string, currentState: PullDataState) : void {
    // Create an array with unique resources only for EvidenceVariables
    if (resourceType === 'EvidenceVariable') {
      currentState.uniqueResources = uniqBy(currentState.resources, res => res.id);
    }
  }

  /**
   * Checks if the loading is complete and there is data in the table
   * for the specified resource type.
   * @param resourceType - resource type
   */
  getHasLoadedData(resourceType: string): boolean {
    return (
      this.resourceStream[resourceType] &&
      this.currentState[resourceType]?.progressValue === 100 &&
      this.currentState[resourceType]?.resources.length > 0
    );
  }

  /**
   * Loads EvidenceVariables for a bundle of Observations.
   * @param bundle - bundle of Observations.
   * @param patientEvCount - mapping patients to the number of loaded variables.
   * @param evObservables - mapping EvidenceVariable URLs to observables of
   *   EvidenceVariable resources.
   * @param perPatientCount - maximum resources per patient.
   * @return observable bundle of EvidenceVariables.
   */
  loadEvidenceVariables(
    bundle: Bundle,
    patientEvCount: { [patientRef: string]: number },
    evObservables: { [evURL: string]: Observable<Resource> },
    perPatientCount: number
  ): Observable<Bundle> {
    const evRequests =
      bundle?.entry
        ?.map((entry) => {
          const patientRef = (entry.resource as Observation).subject.reference;
          // For debugging, we can replace EVs with other resources:
          // const evUrl = `$fhir/Patient?_id=${patientRef}`;
          const evUrl = entry.resource['extension']?.find(
            (x) =>
              x.url ===
              'http://hl7.org/fhir/StructureDefinition/workflow-instantiatesUri'
          )?.valueUri;
          if (!evUrl) {
            return null;
          }
          const evCount =
            patientEvCount[patientRef] || (patientEvCount[patientRef] = 0);
          if (evCount >= perPatientCount) {
            return null;
          }
          ++patientEvCount[patientRef];
          if (!evObservables[evUrl]) {
            evObservables[evUrl] = this.http.get(evUrl, PullDataService.commonHttpOptions)
              // Using `share()` may cause the request to be repeated,
              // see explanation here:
              // https://www.bitovi.com/blog/always-know-when-to-use-share-vs.-sharereplay
              .pipe(shareReplay({ bufferSize: 1, refCount: true }));
          }
          return evObservables[evUrl];
        })
        .filter((p) => p) || [];

    return evRequests.length
      ? forkJoin(evRequests).pipe(
          map((evResponses: Resource[]) => {
            return {
              entry: evResponses.map((ev) => ({ resource: ev }))
            } as Bundle;
          })
        )
      : of({
          entry: []
        } as Bundle);
  }

  /**
   * Processes a bundle of Observations:
   * - limits the amount of resources per patient
   * - excludes duplicates
   * @param observationCodes - list of selected observation codes.
   * @param bundle - bundle of Observations.
   * @param patientToCodeToCount - mapping patients and observation codes to
   *   the number of observations.
   * @param perPatientCount - maximum resources per patient.
   * @param currentState - the current state of pulling data.
   * @return observable bundle of Observations.
   */
  processObservations(
    observationCodes: string[],
    bundle: Bundle,
    patientToCodeToCount: { [patientRef: string]: { [code: string]: number } },
    perPatientCount: number,
    currentState: PullDataState
  ): Observable<Bundle> {
    return !observationCodes.length
      ? of({
          entry: bundle?.entry?.filter((entry: BundleEntry) => {
            const obs = entry.resource as Observation;
            const patientRef = obs.subject.reference;
            // Use the "Code" column value as key for counting, instead of
            // the "Variable Name" column value. This way we will have multiple
            // Observation rows for codes with the same name, as should be the case.
            const codeStr = this.columnValues.getCodeableConceptCode(obs.code);
            const codeToCount =
              patientToCodeToCount[patientRef] ||
              (patientToCodeToCount[patientRef] = {});

            // For now skip Observations without a code in the first coding.
            if (codeStr) {
              const codeCount =
                codeToCount[codeStr] || (codeToCount[codeStr] = 0);
              if (codeCount < perPatientCount) {
                ++codeToCount[codeStr];
                return true;
              }
            }
            return false;
          })
        } as Bundle)
      : // Exclude duplicate observations.
        of({
          entry: differenceBy(
            bundle?.entry,
            currentState.resources,
            (i) => (i as BundleEntry).resource?.id || i.id
          )
        } as Bundle);
  }

  /**
   * Returns a function which extracts resources from the resource bundle and
   * adds Patient info.
   * @param resourceType - resource type.
   * @param patients - patients if we are pulling patients, or one patient if we
   *   are pulling other resources.
   * @param currentState - the current state of pulling data.
   * @return a function
   */
  prepareResponseData(
    resourceType: string,
    patients: Patient[],
    currentState: PullDataState
  ): (bundle: Bundle) => (Resource & PatientMixin)[] {
    return (bundle: Bundle) => {
      const res =
        bundle?.entry?.map((entry) => ({
          ...entry.resource,
          ...(patients.length === 1 ? { patientData: patients[0] } : {})
        })) || [];
      currentState.resources = currentState.resources.concat(res);
      this.updateUniqueResources(resourceType, currentState);
      return res;
    };
  }

  /**
   * Returns a function which updates progress indicator.
   * @param currentState - the current state of pulling data.
   * @param numberOfPatientsInRequest - number of patients in each request.
   * @param observationCodes - selected observation codes.
   * @return a function
   */
  updateProgressIndicator(
    currentState: PullDataState,
    numberOfPatientsInRequest: number,
    observationCodes: string[]
  ): () => void {
    return () => {
      currentState.progressValue +=
        (numberOfPatientsInRequest * 100) /
        (this.cohort.currentState.patients.length *
          (observationCodes.length || 1));
    };
  }
}
