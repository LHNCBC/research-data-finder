/**
 * This file contains a service for pulling data for a cohort of patients.
 */
import { Injectable } from '@angular/core';
import { SelectedObservationCodes } from '../../types/selected-observation-codes';
import { Criteria, ResourceTypeCriteria } from '../../types/search-parameters';
import { CODETEXT } from '../query-params/query-params.service';
import { CohortService } from '../cohort/cohort.service';
import { concatMap, finalize, map } from 'rxjs/operators';
import { from, Observable } from 'rxjs';
import { chunk, differenceBy } from 'lodash-es';
import Patient = fhir.Patient;
import Resource = fhir.Resource;
import Bundle = fhir.Bundle;
import Observation = fhir.Observation;
import { HttpClient } from '@angular/common/http';
import { ColumnValuesService } from '../column-values/column-values.service';
import { FhirBackendService } from '../fhir-backend/fhir-backend.service';

type PatientMixin = { patientData: Patient };

interface PullDataState {
  // Indicates that data is loading
  loading: boolean;
  // Array of loaded resources
  resources: (Resource & PatientMixin)[];
  // Resource loading progress value
  progressValue: number;
}

@Injectable({
  providedIn: 'root'
})
export class PullDataService {
  constructor(
    private cohort: CohortService,
    private fhirBackend: FhirBackendService,
    private http: HttpClient,
    private columnValues: ColumnValuesService
  ) {
    cohort.criteria$.subscribe(() => this.reset());
  }

  currentState: { [resourceType: string]: PullDataState } = {};
  // Stream of resources for ResourceTableComponent
  resourceStream: { [resourceType: string]: Observable<Resource[]> } = {};

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
    return observationCodeArray.reduce(
      (result, cc) => {
        cc.items.forEach((item, index) => {
          if (result.items.indexOf(item) === -1) {
            result.items.push(item);
            result.coding.push(cc.coding[index]);
          }
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
  ): void {
    const currentState: PullDataState = {
      loading: true,
      resources: [],
      progressValue: 0
    };
    this.currentState[resourceType] = currentState;

    const resourceTypeParam =
      resourceType === 'EvidenceVariable' ? 'Observation' : resourceType;
    const observationCodes = [];
    const patientToCodeToCount = {};
    const patientEvCount = {};
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
    const observable = from(
      [].concat(
        ...chunk(
          this.cohort.currentState.patients,
          numberOfPatientsInRequest
        ).map((patients) => {
          let linkToPatient;

          if (resourceType === 'ResearchStudy') {
            linkToPatient = `_has:ResearchSubject:study:individual=${patients
              .map((patient) => patient.id)
              .join(',')}`;
          } else if (resourceType === 'Patient') {
            linkToPatient = `_id=${patients
              .map((patient) => patient.id)
              .join(',')}`;
          } else {
            linkToPatient = `subject=${patients
              .map((patient) => 'Patient/' + patient.id)
              .join(',')}`;
          }

          const prepareResponseData = (bundle) => {
            // Update progress indicator
            currentState.progressValue +=
              (numberOfPatientsInRequest * 100) /
              (this.cohort.currentState.patients.length *
                (observationCodes.length || 1));

            return {
              bundle,
              patientData: patients.length === 1 ? patients[0] : null
            };
          };

          if (observationCodes.length) {
            // Create separate requests for each Observation code
            return observationCodes.map((code) => {
              return (
                this.http
                  .get(
                    `$fhir/${resourceTypeParam}?${linkToPatient}${criteria}${sortParam}&_count=${perPatientCount}&combo-code=${code}`
                  )
                  // toPromise needed to immediately execute query, this allows batch requests
                  .toPromise()
                  .then(prepareResponseData)
              );
            });
          }

          const countParam =
            resourceTypeParam === 'Observation'
              ? // When no code is specified in the criteria, we load the
                // maxObservationToCheck of recent Observations.
                `&_count=${maxObservationToCheck}`
              : `&_count=${perPatientCount}`;
          return (
            this.http
              .get(
                `$fhir/${resourceTypeParam}?${linkToPatient}${criteria}${sortParam}${countParam}`
              )
              // toPromise needed to immediately execute FhirBackendService.handle, this allows batch requests
              .toPromise()
              .then(prepareResponseData)
          );
        })
      )
    ).pipe(
      concatMap(
        (bundlePromise: Promise<{ bundle: Bundle; patientData: Patient }>) => {
          return from(bundlePromise);
          // TODO: Currently we load only 1000 resources per Patient.
          //       (In the previous version of Research Data Finder,
          //       we only loaded the first page with the default size)
          //       Uncommenting the below code will allow loading all resources,
          //       but this could take time.
          /*.pipe(
              // Modifying the Observable to load the following pages sequentially
              expand((response: Bundle) => {
                const nextPageUrl = getNextPageUrl(response);
                if (nextPageUrl) {
                  return from(this.http.get(nextPageUrl).toPromise());
                } else {
                  // Emit a complete notification
                  return EMPTY;
                }
              })
            )*/
        }
      )
    );

    let resourceStream: Observable<Resource[]>;
    // For pulling EV, we first pull Observations and then retrieve EVs asynchronously by looking at
    // Observation extensions.
    if (resourceType === 'EvidenceVariable') {
      resourceStream = observable.pipe(
        concatMap(({ bundle, patientData }) => {
          return (
            bundle?.entry
              ?.map((entry) => {
                const patientRef = (entry.resource as Observation).subject
                  .reference;
                const evUrl = entry.resource['extension']?.find(
                  (x) =>
                    x.url ===
                    'http://hl7.org/fhir/StructureDefinition/workflow-instantiatesUri'
                )?.valueUri;
                if (!evUrl) {
                  return null;
                }
                const evCount =
                  patientEvCount[patientRef] ||
                  (patientEvCount[patientRef] = 0);
                if (evCount >= perPatientCount) {
                  return null;
                }
                ++patientEvCount[patientRef];
                return this.http
                  .get(evUrl)
                  .toPromise()
                  .then((evBundle: Resource) => {
                    return {
                      resource: evBundle,
                      patientData
                    };
                  });
              })
              ?.filter((p) => p) || []
          );
        }),
        concatMap(
          (
            bundlePromise: Promise<{
              resource: Resource;
              patientData: Patient;
            }>
          ) => {
            return from(bundlePromise);
          }
        ),
        map(({ resource, patientData }) => {
          currentState.resources.push({
            ...resource,
            patientData
          });
          return [...currentState.resources];
        })
      );
    } else {
      resourceStream = observable.pipe(
        // Generate a sequence of resources
        map(({ bundle, patientData }) => {
          let res: (Resource & PatientMixin)[] =
            bundle?.entry?.map((entry) => ({
              ...entry.resource,
              patientData
            })) || [];

          if (resourceType === 'Observation') {
            if (!observationCodes.length) {
              res = res.filter((obs: Observation & PatientMixin) => {
                const patientRef = obs.subject.reference;
                const codeStr = this.columnValues.getCodeableConceptAsText(
                  obs.code
                );
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
              });
            } else {
              // Exclude duplicate observations
              res = differenceBy(res, currentState.resources, (i) => i.id);
            }
          }

          currentState.resources.push(...res);
          return [...currentState.resources];
        })
      );
    }

    this.resourceStream[resourceType] = resourceStream.pipe(
      finalize(() => {
        currentState.progressValue = 100;
        currentState.loading = false;
      })
    );
  }

  // Loading is complete and there is data in the table
  getHasLoadedData(resourceType: string): boolean {
    return (
      this.resourceStream[resourceType] &&
      this.currentState[resourceType]?.progressValue === 100 &&
      this.currentState[resourceType]?.resources.length > 0
    );
  }
}
